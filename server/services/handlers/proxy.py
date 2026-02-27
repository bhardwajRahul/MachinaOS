"""Proxy node handlers - proxyRequest, proxyStatus, proxyConfig.

proxyRequest: HTTP request with full proxy controls, retry/failover loop.
proxyStatus: Returns provider health stats for dashboard display.
proxyConfig: Manage proxy providers and routing rules (dual-purpose tool).
"""

import json
import time
from datetime import datetime
from typing import Dict, Any

import httpx

from core.logging import get_logger
from services.proxy.models import ProxyResult
from services.proxy.service import get_proxy_service

logger = get_logger(__name__)


async def _track_proxy_usage(
    node_id: str,
    provider_name: str,
    bytes_transferred: int,
    workflow_id: str = None,
    session_id: str = "default",
) -> Dict[str, float]:
    """Track proxy usage and persist cost to database.

    Cost is calculated as bytes_transferred / 1GB * cost_per_gb
    from server/config/pricing.json proxy section.
    """
    from core.container import container
    from services.pricing import get_pricing_service

    pricing = get_pricing_service()

    # Read cost_per_gb from pricing config
    proxy_pricing = pricing._config.get("proxy", {})
    provider_pricing = proxy_pricing.get(provider_name, {})
    cost_per_gb = provider_pricing.get("cost_per_gb", 0.0)

    gb_transferred = bytes_transferred / (1024 ** 3)
    total_cost = round(gb_transferred * cost_per_gb, 8)

    db = container.database()
    await db.save_api_usage_metric({
        "session_id": session_id,
        "node_id": node_id,
        "workflow_id": workflow_id,
        "service": f"proxy_{provider_name}" if provider_name else "proxy",
        "operation": "proxy_request",
        "endpoint": "proxy",
        "resource_count": 1,
        "cost": total_cost,
    })

    logger.debug(
        f"[Proxy] Tracked {provider_name} usage: {bytes_transferred} bytes = ${total_cost:.8f}"
    )
    return {"cost_per_gb": cost_per_gb, "bytes": bytes_transferred, "total_cost": total_cost}


async def handle_proxy_request(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Handle proxyRequest node execution.

    Makes HTTP requests through configured proxy providers with
    retry/failover, geo-targeting, and result reporting.

    Args:
        node_id: The node ID
        node_type: The node type (proxyRequest)
        parameters: Resolved parameters
        context: Execution context

    Returns:
        Execution result dict with response data
    """
    start_time = time.time()

    try:
        proxy_svc = get_proxy_service()
        if not proxy_svc or not proxy_svc.is_enabled():
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "proxyRequest",
                "error": "Proxy service not initialized. Use proxy_config tool to add a provider first.",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }

        method = parameters.get('method', 'GET')
        url = parameters.get('url', '')
        headers_str = parameters.get('headers', '{}')
        body = parameters.get('body', '')
        timeout = float(parameters.get('timeout', 30))
        max_retries = int(parameters.get('maxRetries', parameters.get('proxyMaxRetries', 3)))
        failover = parameters.get('proxyFailover', True)

        if not url:
            raise ValueError("URL is required")

        # Parse headers JSON
        try:
            headers = json.loads(headers_str) if headers_str else {}
        except json.JSONDecodeError:
            headers = {}

        # Get proxy URL
        proxy_url = await proxy_svc.get_proxy_url(url, parameters)
        if not proxy_url:
            return {
                "success": False,
                "node_id": node_id,
                "node_type": "proxyRequest",
                "error": "No proxy provider available",
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }

        # Determine provider name for result reporting
        provider_name = parameters.get('proxyProvider', '')

        last_error = None
        for attempt in range(max_retries + 1):
            req_start = time.monotonic()
            try:
                async with httpx.AsyncClient(proxy=proxy_url, timeout=timeout) as client:
                    kwargs: Dict[str, Any] = {
                        'method': method,
                        'url': url,
                        'headers': headers,
                    }
                    if method in ['POST', 'PUT', 'PATCH'] and body:
                        try:
                            kwargs['json'] = json.loads(body)
                        except json.JSONDecodeError:
                            kwargs['content'] = body

                    response = await client.request(**kwargs)

                latency_ms = (time.monotonic() - req_start) * 1000
                bytes_transferred = len(response.content) if response.content else 0

                # Report success to health scorer
                proxy_svc.report_result(provider_name, ProxyResult(
                    success=response.status_code < 400,
                    latency_ms=latency_ms,
                    bytes_transferred=bytes_transferred,
                    status_code=response.status_code,
                ))

                # Track cost in database
                workflow_id = context.get("workflow_id")
                session_id = context.get("session_id", "default")
                await _track_proxy_usage(
                    node_id, provider_name, bytes_transferred,
                    workflow_id=workflow_id, session_id=session_id,
                )

                # Parse response
                try:
                    response_data = response.json()
                except Exception:
                    response_data = response.text

                return {
                    "success": response.status_code < 400,
                    "node_id": node_id,
                    "node_type": "proxyRequest",
                    "result": {
                        "status": response.status_code,
                        "data": response_data,
                        "headers": dict(response.headers),
                        "url": str(response.url),
                        "method": method,
                        "proxy_provider": provider_name,
                        "latency_ms": round(latency_ms, 1),
                        "bytes_transferred": bytes_transferred,
                        "attempt": attempt + 1,
                    },
                    "execution_time": time.time() - start_time,
                    "timestamp": datetime.now().isoformat(),
                }

            except Exception as e:
                latency_ms = (time.monotonic() - req_start) * 1000
                last_error = str(e)

                # Report failure
                proxy_svc.report_result(provider_name, ProxyResult(
                    success=False,
                    latency_ms=latency_ms,
                    error=last_error,
                ))

                logger.warning("Proxy request attempt failed",
                               node_id=node_id, attempt=attempt + 1,
                               max_retries=max_retries, error=last_error)

                if not failover or attempt >= max_retries:
                    break

                # Try a different proxy URL for failover
                try:
                    proxy_url = await proxy_svc.get_proxy_url(url, parameters)
                except Exception:
                    break

        return {
            "success": False,
            "node_id": node_id,
            "node_type": "proxyRequest",
            "error": f"All {max_retries + 1} attempts failed. Last error: {last_error}",
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error("Proxy request failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "proxyRequest",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat(),
        }


async def handle_proxy_status(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Handle proxyStatus node execution.

    Returns provider health stats for dashboard display.
    """
    start_time = time.time()

    try:
        proxy_svc = get_proxy_service()
        if not proxy_svc or not proxy_svc.is_enabled():
            return {
                "success": True,
                "node_id": node_id,
                "node_type": "proxyStatus",
                "result": {
                    "enabled": False,
                    "providers": [],
                    "stats": {},
                },
                "execution_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
            }

        stats = proxy_svc.get_stats()
        providers = [p.model_dump() for p in proxy_svc.get_providers()]

        return {
            "success": True,
            "node_id": node_id,
            "node_type": "proxyStatus",
            "result": {
                "enabled": True,
                "providers": providers,
                "stats": stats,
            },
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error("Proxy status check failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "proxyStatus",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat(),
        }


async def handle_proxy_config(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Handle proxyConfig node execution (standalone workflow mode).

    Routes to the tool handler for operation-based dispatch.
    """
    from services.handlers.tools import _execute_proxy_config

    start_time = time.time()
    try:
        result = await _execute_proxy_config(parameters, parameters)
        return {
            "success": result.get("success", False),
            "node_id": node_id,
            "node_type": "proxyConfig",
            "result": result,
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error("Proxy config failed", node_id=node_id, error=str(e))
        return {
            "success": False,
            "node_id": node_id,
            "node_type": "proxyConfig",
            "error": str(e),
            "execution_time": time.time() - start_time,
            "timestamp": datetime.now().isoformat(),
        }
