"""Stripe event source — supervised ``stripe listen`` daemon + the
companion ``WebhookSource`` that receives forwarded events.

Two cooperating sources:

* :class:`StripeListenSource` (DaemonEventSource) keeps the CLI alive,
  captures the ``whsec_…`` signing secret from its stderr banner.
* :class:`StripeWebhookSource` (WebhookSource) is the actual event
  producer — verifies the Stripe-Signature header on each forwarded
  POST and turns the payload into a :class:`WorkflowEvent`.

Module-level singletons (``get_listen_source`` / ``get_webhook_source``)
plug into the framework registries from ``__init__.py``.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Request

from core.logging import get_logger
from services.events import (
    DaemonEventSource,
    StripeVerifier,
    WebhookSource,
    WorkflowEvent,
)

from ._credentials import StripeCredential

logger = get_logger(__name__)

_SECRET_RE = re.compile(r"whsec_[A-Za-z0-9_]+")
_SECRET_FIELD = "stripe_webhook_secret"


class StripeListenSource(DaemonEventSource):
    """Supervises ``stripe listen`` and persists the captured webhook
    signing secret. Emits no events itself — Stripe events arrive over
    HTTP via :class:`StripeWebhookSource`."""

    type = "stripe.listen"
    process_name = "stripe-listen"
    binary_name = "stripe"
    workflow_namespace = "_stripe"
    install_hint = "https://stripe.com/docs/stripe-cli#install"
    credential = StripeCredential

    def build_command(self, secrets: Dict) -> str:
        from core.config import Settings
        port = int(Settings().port)
        return (
            f"stripe listen --forward-to http://localhost:{port}/webhook/stripe "
            f"--print-secret --api-key {secrets['api_key']}"
        )

    def parse_line(self, stream: str, line: str) -> Optional[WorkflowEvent]:
        if stream == "stderr" and (m := _SECRET_RE.search(line)):
            secret = m.group(0)
            asyncio.create_task(self._persist_secret(secret))
        return None

    async def _persist_secret(self, secret: str) -> None:
        try:
            from core.container import container
            await container.auth_service().store_api_key(_SECRET_FIELD, secret, models=[])
            logger.info("[Stripe] webhook signing secret captured and persisted")
        except Exception as e:
            logger.warning("[Stripe] persist secret failed: %s", e)


class StripeWebhookSource(WebhookSource):
    """HTTP receiver for Stripe-forwarded events."""

    type = "stripe.webhook"
    path = "stripe"
    verifier = StripeVerifier
    secret_field = _SECRET_FIELD
    credential = StripeCredential

    async def shape(self, request: Request, body: bytes, payload: dict) -> WorkflowEvent:
        created = payload.get("created")
        try:
            time = datetime.fromtimestamp(int(created), tz=timezone.utc) if created else datetime.now(timezone.utc)
        except (TypeError, ValueError):
            time = datetime.now(timezone.utc)
        account = payload.get("account") or "default"
        return WorkflowEvent(
            id=payload.get("id") or "",
            type=f"stripe.{payload.get('type', 'unknown')}",
            source=f"stripe://{account}",
            time=time,
            data=payload.get("data") or {},
            subject=payload.get("type"),
        )


_listen: Optional[StripeListenSource] = None
_webhook: Optional[StripeWebhookSource] = None


def get_listen_source() -> StripeListenSource:
    global _listen
    if _listen is None:
        _listen = StripeListenSource()
    return _listen


def get_webhook_source() -> StripeWebhookSource:
    global _webhook
    if _webhook is None:
        _webhook = StripeWebhookSource()
    return _webhook
