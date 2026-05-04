"""WorkflowEvent — CloudEvents v1.0 envelope (in-house, no external dep).

Field set mirrors https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
verbatim so future interop with EventBridge / Knative is a JSON-schema swap.
The MachinaOs extensions (workflow_id, trigger_node_id, correlation_id)
ride as CloudEvents extension attributes — fully compliant with the spec.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class WorkflowEvent(BaseModel):
    """Unified event envelope used by every EventSource."""

    specversion: str = "1.0"
    id: str = Field(default_factory=lambda: uuid4().hex)
    source: str
    type: str
    time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subject: Optional[str] = None
    datacontenttype: str = "application/json"
    dataschema: Optional[str] = None
    data: Any = None

    workflow_id: Optional[str] = None
    trigger_node_id: Optional[str] = None
    correlation_id: Optional[str] = None

    model_config = ConfigDict(extra="allow")

    @classmethod
    def from_legacy(cls, event_type: str, payload: dict) -> "WorkflowEvent":
        """Wrap a legacy Dict payload from the pre-framework dispatch path.

        Used by the back-compat shim in event_waiter.dispatch so existing
        plugins (telegram, whatsapp, gmail, etc.) keep working until they
        migrate to native WorkflowEvent emission.
        """
        return cls(
            source=f"legacy://{event_type}",
            type=event_type,
            data=payload,
        )

    def matches_type(self, pattern: str) -> bool:
        """Glob-style match on event type. ``"all"``/empty matches any.

        Examples:
            "stripe.charge.succeeded" matches itself
            "stripe.charge.*"        matches "stripe.charge.succeeded"
            "stripe.*"               matches "stripe.charge.succeeded"
            "all" or ""              matches everything
        """
        if not pattern or pattern == "all":
            return True
        if pattern.endswith(".*"):
            prefix = pattern[:-2]
            return self.type.startswith(prefix + ".") or self.type == prefix
        return self.type == pattern
