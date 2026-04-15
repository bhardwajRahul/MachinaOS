"""Apify Actor — Wave 11.D.8 inlined.

Runs Apify actors (Instagram, TikTok, Twitter, LinkedIn, Google, Crawler)
via the official apify-client SDK. Quick-input helpers merge into the
raw ``actorInput`` JSON for common actors.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

logger = get_logger(__name__)


async def _get_apify_client():
    from apify_client import ApifyClientAsync  # lazy — optional dep
    """Return an authenticated Apify client, or None if no token saved."""
    from core.container import container
    auth_service = container.auth_service()
    api_token = await auth_service.get_api_key("apify", "default")
    if not api_token:
        return None
    return ApifyClientAsync(api_token)


def _build_actor_input(parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Merge actor quick-input helpers into the raw ``actorInput`` JSON."""
    actor_id = parameters.get('actorId', '')
    if actor_id == 'custom':
        actor_id = parameters.get('customActorId', '')

    actor_input = parameters.get('actorInput', '{}')
    if isinstance(actor_input, str):
        try:
            actor_input = json.loads(actor_input) if actor_input.strip() else {}
        except json.JSONDecodeError:
            actor_input = {}
    elif not isinstance(actor_input, dict):
        actor_input = {}

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


async def validate_apify_token(api_token: str) -> Dict[str, Any]:
    """Validate an Apify API token by fetching /users/me.

    Used by the websocket ``validate_apify_key`` handler and by the
    Credentials modal. Lives on the plugin so there's no handler-file
    ghost left behind after Wave 11.D.8.
    """
    try:
        from apify_client import ApifyClientAsync  # lazy — optional dep
        client = ApifyClientAsync(api_token)
        user_info = await client.user("me").get()
        if not user_info:
            return {"valid": False, "error": "Could not fetch user info"}
        plan = user_info.get("plan")
        return {
            "valid": True,
            "username": user_info.get("username", ""),
            "email": user_info.get("email", ""),
            "plan": plan.get("id", "free") if isinstance(plan, dict) else "free",
        }
    except Exception as e:
        logger.error(f"[Apify] Token validation error: {e}")
        msg = str(e)
        if "401" in msg or "Unauthorized" in msg:
            return {"valid": False, "error": "Invalid API token"}
        return {"valid": False, "error": msg}


class ApifyActorParams(BaseModel):
    actor_id: str = Field(default="", alias="actorId")
    actor_input: Any = Field(default_factory=dict, alias="actorInput")
    max_results: int = Field(default=100, alias="maxResults", ge=1, le=10000)
    timeout: int = Field(default=300, ge=1, le=3600)
    memory: int = Field(default=1024, ge=128, le=8192)

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ApifyActorOutput(BaseModel):
    run_id: Optional[str] = None
    actor_id: Optional[str] = None
    status: Optional[str] = None
    items: Optional[list] = None
    item_count: Optional[int] = None
    dataset_id: Optional[str] = None
    compute_units: Optional[float] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ApifyActorNode(ActionNode):
    type = "apifyActor"
    display_name = "Apify Actor"
    subtitle = "Web Scraper"
    icon = "asset:apify"
    color = "#ff79c6"
    group = ("api", "scraper", "tool")
    description = "Run Apify actors for Instagram, TikTok, Twitter, LinkedIn, etc."
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": True, "open_world": True}
    task_queue = TaskQueue.REST_API
    usable_as_tool = True

    Params = ApifyActorParams
    Output = ApifyActorOutput

    @Operation("run")
    async def run(self, ctx: NodeContext, params: ApifyActorParams) -> ApifyActorOutput:
        client = await _get_apify_client()
        if not client:
            raise RuntimeError(
                "Apify API token not configured. Please add your token in Credentials.",
            )

        p = params.model_dump(by_alias=True)
        actor_id = p.get("actorId", "")
        if actor_id == "custom":
            actor_id = p.get("customActorId", "")
        if not actor_id:
            raise RuntimeError("Actor ID is required")

        actor_input = _build_actor_input(p)
        timeout_secs = int(p.get("timeout", 300))
        max_results = int(p.get("maxResults", 100))
        memory_mbytes = int(p.get("memory", 1024))

        logger.info(
            f"[Apify] Running actor {actor_id} "
            f"timeout={timeout_secs}s memory={memory_mbytes}MB",
        )
        run_info = await client.actor(actor_id).call(
            run_input=actor_input,
            timeout_secs=timeout_secs,
            memory_mbytes=memory_mbytes,
        )

        if run_info is None:
            raise RuntimeError("Actor run failed - no result returned")

        status = run_info.get("status", "UNKNOWN")
        run_id = run_info.get("id", "")
        dataset_id = run_info.get("defaultDatasetId", "")

        if status == "FAILED":
            raise RuntimeError(run_info.get("errorMessage", "Actor run failed"))
        if status == "TIMED-OUT":
            raise RuntimeError("Actor timed out. Try increasing the timeout.")
        if status == "ABORTED":
            raise RuntimeError("Actor run was aborted")

        items: List[Dict[str, Any]] = []
        if dataset_id:
            listing = await client.dataset(dataset_id).list_items(limit=max_results)
            items = listing.items if listing else []
            logger.info(f"[Apify] Actor {actor_id} completed: {len(items)} items")

        return ApifyActorOutput(
            run_id=run_id,
            actor_id=actor_id,
            status=status,
            items=items,
            item_count=len(items),
            dataset_id=dataset_id,
            compute_units=run_info.get("usageTotalUsd", 0),
            started_at=run_info.get("startedAt", ""),
            finished_at=run_info.get("finishedAt", ""),
        )
