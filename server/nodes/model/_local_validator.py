"""Local-LLM credential validator (Ollama, LM Studio).

Lives next to the chat-model plugins so all per-provider behaviour for
the local servers stays in `nodes/model/`. Registered into
`routers.websocket._SPECIAL_PROVIDER_VALIDATORS` from the same place
the cloud-provider mapping is declared — same shim shape as apify and
google_maps, the function body just lives here instead.

The frontend reuses the standard ``validate_api_key`` WebSocket message
for these providers; the ``api_key`` field carries the user's Base URL,
not a secret. We:

1. Save the URL under ``{provider}_proxy`` — the existing Ollama-style
   auth-delegation key that ``AIService.create_model`` and
   ``AIService.fetch_models`` already read.
2. Call ``ai_service.fetch_models(provider, "ollama")`` which (after the
   proxy_url passthrough in services/ai.py) probes the user's URL and
   returns the actually-installed models.
3. Store the placeholder api_key + discovered model list under the
   provider id so the Provider Defaults dropdown shows real entries.
4. Return ``valid=True`` only when at least one model was found, so a
   misconfigured URL surfaces as a clear "no models" message instead
   of a silent success.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import WebSocket

from core.container import container
from core.logging import get_logger
from services.status_broadcaster import get_status_broadcaster

logger = get_logger(__name__)


async def validate_local_llm(data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
    """Validator for ollama / lmstudio. Matches the SPECIAL_PROVIDER_VALIDATORS contract."""
    provider = data["provider"].lower()
    base_url = data.get("api_key", "").strip()
    session_id = data.get("session_id", "default")

    if not base_url:
        return {"success": False, "valid": False, "error": "Base URL required"}

    auth_service = container.auth_service()
    ai_service = container.ai_service()
    broadcaster = get_status_broadcaster()

    # Persist the URL first so the upcoming fetch_models call can read
    # it via the existing {provider}_proxy lookup. Without this step
    # the probe would hit the JSON default base_url, not the user's
    # custom server.
    await auth_service.store_api_key(
        provider=f"{provider}_proxy",
        api_key=base_url,
        models=[],
        session_id=session_id,
    )

    try:
        models = await ai_service.fetch_models(provider, "ollama")
    except Exception as e:
        logger.warning("[%s] fetch_models failed: %s", provider, e)
        models = []

    if not models:
        message = (
            f"Saved URL but {provider} returned no models — is the server "
            "running and a model loaded?"
        )
        await broadcaster.update_api_key_status(
            provider=provider, valid=False, message=message,
            has_key=True, models=[],
        )
        return {"success": True, "valid": False, "message": message, "models": []}

    # Store placeholder api_key + the real model list. The placeholder
    # ("ollama") is the documented value LiteLLM / OpenAI clients accept
    # for unauthenticated local servers; it's never sent over the wire
    # because OpenAIProvider rewrites it when proxy_url is set.
    await auth_service.store_api_key(
        provider=provider,
        api_key="ollama",
        models=models,
        session_id=session_id,
    )
    await broadcaster.update_api_key_status(
        provider=provider, valid=True,
        message=f"{len(models)} model(s) discovered at {base_url}",
        has_key=True, models=models,
    )
    return {
        "provider": provider, "success": True, "valid": True,
        "models": models, "message": f"Connected to {provider} at {base_url}",
        "timestamp": time.time(),
    }
