"""Todo list service -- JSON-based per-session todo state management.

Provides the write_todos tool capability for AI agents to create and manage
structured task lists during complex multi-step operations.

State is persisted as JSON strings, keyed by session identifier.
Follows the singleton pattern used by browser_service.py and telegram_service.py.
"""

import json
from typing import Dict, List, Optional

from core.logging import get_logger

logger = get_logger(__name__)

VALID_STATUSES = frozenset(("pending", "in_progress", "completed"))


class TodoService:
    """Manages per-session todo lists stored as JSON.

    Each session maintains an independent todo list that persists across
    tool calls within the same execution.
    """

    def __init__(self):
        self._store: Dict[str, str] = {}  # session_key -> JSON string

    def write(self, session_key: str, todos: List[dict]) -> List[dict]:
        """Replace the todo list for a session.

        Validates each item, serializes to JSON, and stores.

        Args:
            session_key: Session identifier (workflow_id or node_id).
            todos: List of todo dicts with 'content' and 'status' keys.

        Returns:
            The validated and stored todo list.
        """
        validated = []
        for item in todos:
            if not isinstance(item, dict):
                continue
            content = str(item.get("content", "")).strip()
            if not content:
                continue
            status = item.get("status", "pending")
            if status not in VALID_STATUSES:
                status = "pending"
            validated.append({"content": content, "status": status})

        self._store[session_key] = json.dumps(validated)
        logger.debug(
            "[TodoService] Updated session=%s: %d items (%d pending, %d in_progress, %d completed)",
            session_key,
            len(validated),
            sum(1 for t in validated if t["status"] == "pending"),
            sum(1 for t in validated if t["status"] == "in_progress"),
            sum(1 for t in validated if t["status"] == "completed"),
        )
        return validated

    def get(self, session_key: str) -> List[dict]:
        """Get current todo list for a session, deserialized from JSON."""
        raw = self._store.get(session_key)
        if not raw:
            return []
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return []

    def get_json(self, session_key: str) -> str:
        """Get current todo list as a raw JSON string."""
        return self._store.get(session_key, "[]")

    def clear(self, session_key: str) -> None:
        """Clear todos for a session."""
        self._store.pop(session_key, None)

    def format_for_llm(self, session_key: str) -> str:
        """Format todos as JSON string for LLM consumption."""
        return self.get_json(session_key)


_service: Optional[TodoService] = None


def get_todo_service() -> TodoService:
    """Lazy singleton accessor."""
    global _service
    if _service is None:
        _service = TodoService()
    return _service
