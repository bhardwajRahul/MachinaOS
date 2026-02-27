"""HTTP node handlers - HTTP Request and Webhook Response."""

import json
import time
from datetime import datetime
from typing import Any, Dict, Optional
from core.logging import get_logger

logger = get_logger(__name__)


async def _get_proxy_url_if_enabled(url: str, parameters: Dict[str, Any]) -> Optional[str]:
    """Return a proxy URL if useProxy is enabled and a provider is available.

    Returns None when proxy should not be used (disabled, no providers, etc.).
    Exceptions from the proxy service are logged and swallowed so that the
    request proceeds without a proxy rather than failing.
    """
    if not parameters.get('useProxy', False):
        return None

    try:
        from services.proxy.service import get_proxy_service
        proxy_svc = get_proxy_service()
        if not proxy_svc or not proxy_svc.is_enabled():
            return None
        return await proxy_svc.get_proxy_url(url, parameters)
    except Exception as e:
        logger.warning("Proxy URL lookup failed, proceeding without proxy", error=str(e))
        return None


async def handle_http_request(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle HTTP request node execution.

    Makes HTTP requests to external APIs.

    Args:
        node_id: The node ID
        node_type: The node type (httpRequest)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with response data
    """
    import httpx
    start_time = time.time()

    try:
        method = parameters.get('method', 'GET')
        url = parameters.get('url', '')
        headers_str = parameters.get('headers', '{}')
        body = parameters.get('body', '')
        timeout = float(parameters.get('timeout', 30))

        if not url:
            raise ValueError("URL is required")

        # Parse headers JSON
        try:
            headers = json.loads(headers_str) if headers_str else {}
        except json.JSONDecodeError:
            headers = {}

        # Transparent proxy injection
        proxy_url = await _get_proxy_url_if_enabled(url, parameters)
        logger.info("[HTTP Request] Executing", node_id=node_id, method=method, url=url,
                     proxy=bool(proxy_url))

        client_kwargs: Dict[str, Any] = {"timeout": timeout}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        async with httpx.AsyncClient(**client_kwargs) as client:
            kwargs = {
                'method': method,
                'url': url,
                'headers': headers,
            }

            # Add body for POST/PUT/PATCH
            if method in ['POST', 'PUT', 'PATCH'] and body:
                try:
                    kwargs['json'] = json.loads(body)
                except json.JSONDecodeError:
                    kwargs['content'] = body

            response = await client.request(**kwargs)

            # Parse response data
            try:
                response_data = response.json()
            except Exception:
                response_data = response.text

            result_data = {
                "status": response.status_code,
                "data": response_data,
                "headers": dict(response.headers),
                "url": str(response.url),
                "method": method,
                "proxied": proxy_url is not None,
            }

            return {
                "success": response.status_code < 400,
                "node_id": node_id,
                "node_type": "httpRequest",
                "result": result_data,
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        if "TimeoutException" in type(e).__name__:
            logger.error("HTTP request timed out", node_id=node_id, url=parameters.get('url'))
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "httpRequest",
                "error": f"Request timed out after {parameters.get('timeout', 30)} seconds",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat()
            }
        logger.error("HTTP request failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "httpRequest",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }


async def handle_webhook_response(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
    connected_outputs: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Handle webhook response node execution.

    Sends response back to waiting webhook caller.

    Args:
        node_id: The node ID
        node_type: The node type (webhookResponse)
        parameters: Resolved parameters
        context: Execution context
        connected_outputs: Outputs from connected nodes

    Returns:
        Execution result dict
    """
    from routers.webhook import resolve_webhook_response
    start_time = time.time()

    try:
        status_code = int(parameters.get('statusCode', 200))
        response_body = parameters.get('responseBody', '')
        content_type = parameters.get('contentType', 'application/json')

        # Resolve template variables in response body
        if response_body and connected_outputs:
            for node_type_key, output_data in connected_outputs.items():
                if isinstance(output_data, dict):
                    for key, value in output_data.items():
                        template = f"{{{{input.{key}}}}}"
                        response_body = response_body.replace(template, str(value))
                        # Also support {{nodeType.key}} format
                        template_alt = f"{{{{{node_type_key}.{key}}}}}"
                        response_body = response_body.replace(template_alt, str(value))

        # If response body is empty, serialize connected outputs as JSON
        if not response_body and connected_outputs:
            # Get the first connected output
            first_output = next(iter(connected_outputs.values()), {})
            response_body = json.dumps(first_output, default=str)

        logger.info("[Webhook Response] Sending", node_id=node_id, status_code=status_code,
                   content_type=content_type, body_length=len(response_body))

        # Resolve the pending webhook response
        resolve_webhook_response(node_id, {
            'statusCode': status_code,
            'body': response_body,
            'contentType': content_type
        })

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "webhookResponse",
            "result": {
                "sent": True,
                "statusCode": status_code,
                "contentType": content_type,
                "bodyLength": len(response_body)
            },
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("Webhook response failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "webhookResponse",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat()
        }
