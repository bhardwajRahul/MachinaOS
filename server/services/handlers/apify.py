"""Apify node handlers using official apify-client SDK."""

import json
import time
from typing import Dict, Any, Optional, List

from apify_client import ApifyClientAsync

from core.logging import get_logger

logger = get_logger(__name__)


async def _get_apify_client(context: Dict[str, Any]) -> Optional[ApifyClientAsync]:
    """Get authenticated Apify client from stored credentials."""
    from core.container import container
    auth_service = container.auth_service()
    api_token = await auth_service.get_api_key("apify", "default")
    if not api_token:
        return None
    return ApifyClientAsync(api_token)


def _build_actor_input(parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Build actor input from parameters, merging quick helpers with raw JSON input."""
    actor_id = parameters.get('actorId', '')
    if actor_id == 'custom':
        actor_id = parameters.get('customActorId', '')

    # Start with raw JSON input if provided
    actor_input = parameters.get('actorInput', '{}')
    if isinstance(actor_input, str):
        try:
            actor_input = json.loads(actor_input) if actor_input.strip() else {}
        except json.JSONDecodeError:
            actor_input = {}
    elif not isinstance(actor_input, dict):
        actor_input = {}

    # Merge quick helpers based on actor type
    if actor_id == 'apify/instagram-scraper':
        urls = parameters.get('instagramUrls', '')
        if urls:
            actor_input['directUrls'] = [u.strip() for u in urls.split(',') if u.strip()]

    elif actor_id == 'clockworks/tiktok-scraper':
        profiles = parameters.get('tiktokProfiles', '')
        hashtags = parameters.get('tiktokHashtags', '')
        if profiles:
            actor_input['profiles'] = [p.strip() for p in profiles.split(',') if p.strip()]
        if hashtags:
            actor_input['hashtags'] = [h.strip() for h in hashtags.split(',') if h.strip()]

    elif actor_id == 'apidojo/tweet-scraper':
        search_terms = parameters.get('twitterSearchTerms', '')
        handles = parameters.get('twitterHandles', '')
        if search_terms:
            actor_input['searchTerms'] = [t.strip() for t in search_terms.split(',') if t.strip()]
        if handles:
            actor_input['twitterHandles'] = [h.strip() for h in handles.split(',') if h.strip()]

    elif actor_id == 'apify/google-search-scraper':
        query = parameters.get('googleSearchQuery', '')
        pages = parameters.get('googleSearchPages', 1)
        if query:
            actor_input['searchQuery'] = query
            actor_input['maxPagesPerQuery'] = pages

    elif actor_id == 'apify/website-content-crawler':
        start_urls = parameters.get('crawlerStartUrls', '')
        max_depth = parameters.get('crawlerMaxDepth', 2)
        max_pages = parameters.get('crawlerMaxPages', 50)
        if start_urls:
            actor_input['startUrls'] = [{'url': u.strip()} for u in start_urls.split(',') if u.strip()]
            actor_input['maxCrawlDepth'] = max_depth
            actor_input['maxCrawlPages'] = max_pages

    return actor_input


async def handle_apify_actor(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Run an Apify actor and return results using official SDK.

    Args:
        node_id: Node ID
        node_type: Node type ('apifyActor')
        parameters: Node parameters including actorId, actorInput, maxResults, timeout
        context: Execution context

    Returns:
        Dict with success status, results, and execution metadata
    """
    start_time = time.time()

    try:
        # Get authenticated client
        client = await _get_apify_client(context)
        if not client:
            return {
                "success": False,
                "error": "Apify API token not configured. Please add your token in Credentials.",
                "execution_time": time.time() - start_time
            }

        # Get actor ID
        actor_id = parameters.get("actorId", "")
        if actor_id == "custom":
            actor_id = parameters.get("customActorId", "")
        if not actor_id:
            return {
                "success": False,
                "error": "Actor ID is required",
                "execution_time": time.time() - start_time
            }

        # Build actor input
        actor_input = _build_actor_input(parameters)

        # Get execution options
        timeout_secs = parameters.get("timeout", 300)
        max_results = parameters.get("maxResults", 100)
        memory_mbytes = parameters.get("memory", 1024)

        logger.info(f"[Apify] Running actor {actor_id} with timeout={timeout_secs}s, memory={memory_mbytes}MB")

        # Get actor client and run
        actor_client = client.actor(actor_id)

        # call() runs the actor and waits for it to finish
        # SDK handles polling and retries automatically
        run_info = await actor_client.call(
            run_input=actor_input,
            timeout_secs=timeout_secs,
            memory_mbytes=memory_mbytes
        )

        if run_info is None:
            return {
                "success": False,
                "error": "Actor run failed - no result returned",
                "execution_time": time.time() - start_time
            }

        run_status = run_info.get("status", "UNKNOWN")
        run_id = run_info.get("id", "")
        dataset_id = run_info.get("defaultDatasetId", "")

        # Handle non-success statuses
        if run_status == "FAILED":
            error_msg = run_info.get("errorMessage", "Actor run failed")
            logger.error(f"[Apify] Actor {actor_id} failed: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "result": {
                    "run_id": run_id,
                    "actor_id": actor_id,
                    "status": run_status
                },
                "execution_time": time.time() - start_time
            }
        elif run_status == "TIMED-OUT":
            logger.warning(f"[Apify] Actor {actor_id} timed out")
            return {
                "success": False,
                "error": f"Actor timed out. Try increasing the timeout.",
                "result": {
                    "run_id": run_id,
                    "actor_id": actor_id,
                    "status": run_status
                },
                "execution_time": time.time() - start_time
            }
        elif run_status == "ABORTED":
            return {
                "success": False,
                "error": "Actor run was aborted",
                "result": {
                    "run_id": run_id,
                    "actor_id": actor_id,
                    "status": run_status
                },
                "execution_time": time.time() - start_time
            }

        # Get results from dataset
        items: List[Dict[str, Any]] = []
        if dataset_id:
            dataset_client = client.dataset(dataset_id)
            list_result = await dataset_client.list_items(limit=max_results)
            items = list_result.items if list_result else []
            logger.info(f"[Apify] Actor {actor_id} completed: {len(items)} items retrieved")

        # Build result
        result = {
            "run_id": run_id,
            "actor_id": actor_id,
            "status": run_status,
            "items": items,
            "item_count": len(items),
            "dataset_id": dataset_id,
            "compute_units": run_info.get("usageTotalUsd", 0),
            "started_at": run_info.get("startedAt", ""),
            "finished_at": run_info.get("finishedAt", "")
        }

        return {
            "success": True,
            "result": result,
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"[Apify] Error: {e}")
        error_msg = str(e)
        # Improve error messages for common cases
        if "401" in error_msg or "Unauthorized" in error_msg:
            error_msg = "Invalid Apify API token. Please check your credentials."
        elif "404" in error_msg or "not found" in error_msg.lower():
            error_msg = f"Actor not found. Check the actor ID."
        return {
            "success": False,
            "error": error_msg,
            "execution_time": time.time() - start_time
        }


async def validate_apify_token(api_token: str) -> Dict[str, Any]:
    """Validate Apify API token by fetching user info.

    Args:
        api_token: Apify API token to validate

    Returns:
        Dict with 'valid' boolean and user info if valid
    """
    try:
        client = ApifyClientAsync(api_token)
        user_client = client.user("me")
        user_info = await user_client.get()

        if user_info:
            return {
                "valid": True,
                "username": user_info.get("username", ""),
                "email": user_info.get("email", ""),
                "plan": user_info.get("plan", {}).get("id", "free") if isinstance(user_info.get("plan"), dict) else "free"
            }
        return {"valid": False, "error": "Could not fetch user info"}

    except Exception as e:
        logger.error(f"[Apify] Token validation error: {e}")
        error_msg = str(e)
        if "401" in error_msg or "Unauthorized" in error_msg:
            return {"valid": False, "error": "Invalid API token"}
        return {"valid": False, "error": str(e)}
