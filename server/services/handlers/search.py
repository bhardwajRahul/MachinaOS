"""Search API node handlers - Brave Search, Serper, Perplexity Sonar.

Each handler fetches the API key from the encrypted credentials system
via auth_service, then calls the provider's API.
"""

import time
from typing import Dict, Any

import httpx

from core.logging import get_logger
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_search_usage(
    node_id: str,
    service: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track search API usage for cost calculation."""
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost(service, action, resource_count)

    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': service,
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Search] Tracked {service} usage: {action} x{resource_count} = ${cost_data.get('total_cost', 0):.6f}")
    return cost_data


async def _get_api_key(provider: str) -> str:
    """Get API key from encrypted credentials."""
    from core.container import container
    auth_service = container.auth_service()
    api_key = await auth_service.get_api_key(provider)
    if not api_key:
        raise ValueError(
            f"{provider} API key not configured. "
            f"Please add it in Credentials > Search."
        )
    return api_key


# =============================================================================
# BRAVE SEARCH HANDLER
# =============================================================================

async def handle_brave_search(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Brave Search API requests.

    API: GET https://api.search.brave.com/res/v1/web/search
    Auth: X-Subscription-Token header
    """
    start_time = time.time()

    query = parameters.get('query', '').strip()
    if not query:
        return {"success": False, "error": "Search query is required"}

    max_results = parameters.get('maxResults', 10)
    country = parameters.get('country', '')
    search_lang = parameters.get('searchLang', '')
    safe_search = parameters.get('safeSearch', 'moderate')

    try:
        api_key = await _get_api_key('brave_search')

        params = {
            'q': query,
            'count': min(max_results, 100),
        }
        if country:
            params['country'] = country
        if search_lang:
            params['search_lang'] = search_lang
        if safe_search:
            params['safesearch'] = safe_search

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                'https://api.search.brave.com/res/v1/web/search',
                headers={
                    'X-Subscription-Token': api_key,
                    'Accept': 'application/json',
                },
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        # Extract web results
        web_results = data.get('web', {}).get('results', [])
        results = []
        for item in web_results[:max_results]:
            results.append({
                'title': item.get('title', ''),
                'snippet': item.get('description', ''),
                'url': item.get('url', ''),
            })

        execution_time = time.time() - start_time

        # Track usage
        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')
        await _track_search_usage(node_id, 'brave_search', 'web_search', 1, workflow_id, session_id)

        return {
            "success": True,
            "result": {
                "query": query,
                "results": results,
                "result_count": len(results),
                "provider": "brave_search",
            },
            "execution_time": round(execution_time, 3),
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"[BraveSearch] API error: {e.response.status_code} - {e.response.text}")
        return {"success": False, "error": f"Brave Search API error: {e.response.status_code}"}
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"[BraveSearch] Error: {e}")
        return {"success": False, "error": f"Brave Search failed: {str(e)}"}


# =============================================================================
# SERPER SEARCH HANDLER
# =============================================================================

async def handle_serper_search(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Serper (Google) Search API requests.

    API: POST https://google.serper.dev/search
    Auth: X-API-KEY header
    """
    start_time = time.time()

    query = parameters.get('query', '').strip()
    if not query:
        return {"success": False, "error": "Search query is required"}

    max_results = parameters.get('maxResults', 10)
    search_type = parameters.get('searchType', 'search')
    country = parameters.get('country', '')
    language = parameters.get('language', '')

    try:
        api_key = await _get_api_key('serper')

        body: Dict[str, Any] = {
            'q': query,
            'num': min(max_results, 100),
        }
        if country:
            body['gl'] = country
        if language:
            body['hl'] = language

        # Map search type to endpoint
        endpoint_map = {
            'search': 'https://google.serper.dev/search',
            'news': 'https://google.serper.dev/news',
            'images': 'https://google.serper.dev/images',
            'places': 'https://google.serper.dev/places',
        }
        endpoint = endpoint_map.get(search_type, 'https://google.serper.dev/search')

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                endpoint,
                headers={
                    'X-API-KEY': api_key,
                    'Content-Type': 'application/json',
                },
                json=body,
            )
            response.raise_for_status()
            data = response.json()

        # Extract results based on search type
        results = []
        if search_type == 'search':
            for item in data.get('organic', [])[:max_results]:
                results.append({
                    'title': item.get('title', ''),
                    'snippet': item.get('snippet', ''),
                    'url': item.get('link', ''),
                    'position': item.get('position'),
                })
        elif search_type == 'news':
            for item in data.get('news', [])[:max_results]:
                results.append({
                    'title': item.get('title', ''),
                    'snippet': item.get('snippet', ''),
                    'url': item.get('link', ''),
                    'date': item.get('date', ''),
                    'source': item.get('source', ''),
                })
        elif search_type == 'images':
            for item in data.get('images', [])[:max_results]:
                results.append({
                    'title': item.get('title', ''),
                    'imageUrl': item.get('imageUrl', ''),
                    'url': item.get('link', ''),
                })
        elif search_type == 'places':
            for item in data.get('places', [])[:max_results]:
                results.append({
                    'title': item.get('title', ''),
                    'address': item.get('address', ''),
                    'rating': item.get('rating'),
                    'url': item.get('website', ''),
                })

        # Include knowledge graph if available
        knowledge_graph = data.get('knowledgeGraph')

        execution_time = time.time() - start_time

        # Track usage
        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')
        await _track_search_usage(node_id, 'serper', 'web_search', 1, workflow_id, session_id)

        result = {
            "query": query,
            "results": results,
            "result_count": len(results),
            "search_type": search_type,
            "provider": "serper",
        }
        if knowledge_graph:
            result["knowledge_graph"] = knowledge_graph

        return {
            "success": True,
            "result": result,
            "execution_time": round(execution_time, 3),
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"[Serper] API error: {e.response.status_code} - {e.response.text}")
        return {"success": False, "error": f"Serper API error: {e.response.status_code}"}
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"[Serper] Error: {e}")
        return {"success": False, "error": f"Serper search failed: {str(e)}"}


# =============================================================================
# PERPLEXITY SEARCH HANDLER
# =============================================================================

async def handle_perplexity_search(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Perplexity Sonar AI search requests.

    API: POST https://api.perplexity.ai/chat/completions
    Auth: Authorization: Bearer header
    """
    start_time = time.time()

    query = parameters.get('query', '').strip()
    if not query:
        return {"success": False, "error": "Search query is required"}

    model = parameters.get('model', 'sonar')
    search_recency_filter = parameters.get('searchRecencyFilter', '')
    return_images = parameters.get('returnImages', False)
    return_related_questions = parameters.get('returnRelatedQuestions', False)

    try:
        api_key = await _get_api_key('perplexity')

        body: Dict[str, Any] = {
            'model': model,
            'messages': [
                {'role': 'user', 'content': query}
            ],
        }

        if search_recency_filter:
            body['search_recency_filter'] = search_recency_filter
        if return_images:
            body['return_images'] = True
        if return_related_questions:
            body['return_related_questions'] = True

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                'https://api.perplexity.ai/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
                json=body,
            )
            response.raise_for_status()
            data = response.json()

        # Extract answer and citations
        choices = data.get('choices', [])
        answer = ''
        if choices:
            message = choices[0].get('message', {})
            answer = message.get('content', '')

        citations = data.get('citations', [])
        images = data.get('images', [])
        related_questions = data.get('related_questions', [])

        # Build results from citations
        results = []
        for url in citations:
            results.append({'url': url})

        execution_time = time.time() - start_time

        # Track usage
        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')
        await _track_search_usage(node_id, 'perplexity', 'sonar_search', 1, workflow_id, session_id)

        result: Dict[str, Any] = {
            "query": query,
            "answer": answer,
            "citations": citations,
            "results": results,
            "model": model,
            "provider": "perplexity",
        }
        if images:
            result["images"] = images
        if related_questions:
            result["related_questions"] = related_questions

        return {
            "success": True,
            "result": result,
            "execution_time": round(execution_time, 3),
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"[Perplexity] API error: {e.response.status_code} - {e.response.text}")
        return {"success": False, "error": f"Perplexity API error: {e.response.status_code}"}
    except ValueError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"[Perplexity] Error: {e}")
        return {"success": False, "error": f"Perplexity search failed: {str(e)}"}
