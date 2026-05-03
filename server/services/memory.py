"""Markdown-based conversation memory helpers.

Parse, append, trim, and archive conversation history stored in markdown format.
Used by AI Agent and Chat Agent for persistent memory across turns.
"""

import re
from datetime import datetime
from typing import Dict, Any, List

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

from core.logging import get_logger

logger = get_logger(__name__)


def parse_memory_markdown(content: str) -> List[BaseMessage]:
    """Parse markdown memory content into LangChain messages.

    Markdown format:
    ### **Human** (timestamp)
    message content

    ### **Assistant** (timestamp)
    response content
    """
    messages = []
    pattern = r'### \*\*(Human|Assistant)\*\*[^\n]*\n(.*?)(?=\n### \*\*|$)'
    for role, text in re.findall(pattern, content, re.DOTALL):
        text = text.strip()
        if text:
            msg_class = HumanMessage if role == 'Human' else AIMessage
            messages.append(msg_class(content=text))
    return messages


def append_to_memory_markdown(content: str, role: str, message: str) -> str:
    """Append a message to markdown memory content."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    label = "Human" if role == "human" else "Assistant"
    entry = f"\n### **{label}** ({ts})\n{message}\n"
    # Remove empty state message if present
    return content.replace("*No messages yet.*\n", "") + entry


def trim_markdown_window(content: str, window_size: int) -> tuple:
    """Keep last N message pairs, return (trimmed_content, removed_texts).

    Args:
        content: Full markdown content
        window_size: Number of message PAIRS to keep (human+assistant)

    Returns:
        Tuple of (trimmed markdown, list of removed message texts for archival)
    """
    pattern = r'(### \*\*(Human|Assistant)\*\*[^\n]*\n.*?)(?=\n### \*\*|$)'
    blocks = [m[0] for m in re.findall(pattern, content, re.DOTALL)]

    if len(blocks) <= window_size * 2:
        return content, []

    keep = blocks[-(window_size * 2):]
    removed = blocks[:-(window_size * 2)]

    # Extract text from removed blocks for vector storage
    removed_texts = []
    for block in removed:
        match = re.search(r'\n(.*)$', block, re.DOTALL)
        if match:
            removed_texts.append(match.group(1).strip())

    return "# Conversation History\n" + "\n".join(keep), removed_texts


# Global cache for vector stores per session (InMemoryVectorStore)
_memory_vector_stores: Dict[str, Any] = {}


def get_memory_vector_store(session_id: str):
    """Get or create InMemoryVectorStore for a session."""
    if session_id not in _memory_vector_stores:
        try:
            from langchain_core.vectorstores import InMemoryVectorStore
            from langchain_huggingface import HuggingFaceEmbeddings

            embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
            _memory_vector_stores[session_id] = InMemoryVectorStore(embeddings)
            logger.debug(f"[Memory] Created vector store for session '{session_id}'")
        except ImportError as e:
            logger.warning(f"[Memory] Vector store not available: {e}")
            return None
    return _memory_vector_stores[session_id]


def clear_agent_session_state(
    session_id: str,
    workflow_id: str = None,
    clear_long_term: bool = False,
) -> Dict[str, Any]:
    """Clear every store keyed by an agent's conversational scope.

    "Memory" from the user's perspective is not just the markdown
    transcript — it's every piece of state an agent reuses across
    iterations of a conversation. ``simpleMemory.memory_content`` is the
    visible part; the long-term vector store and ``TodoService``
    plan-work-update lists are the invisible parts that quietly bloat
    subsequent runs (notably ``task_agent``, whose default skill bundle
    instructs the LLM to read accumulated todos every run).

    ``TodoService`` is keyed by ``ctx.workflow_id or ctx.node_id or
    "default"`` (see ``server/nodes/tool/write_todos.py``). We clear all
    three candidate keys to match whichever fallback the agent actually
    used at write time.

    Args:
        session_id: ``simpleMemory`` node's ``session_id`` parameter.
        workflow_id: Active workflow id (passed by the frontend so we
            can clear ``TodoService`` entries written under it).
        clear_long_term: When ``True``, drop the per-session vector
            store too.

    Returns:
        Dict with ``cleared_vector_store`` (bool) and ``cleared_todo_keys``
        (list[str]) for caller-visible diagnostics. Markdown reset is
        signalled by returning the default content, owned by the WS
        handler so the wire shape stays in one place.
    """
    # The live vector-store cache lives in ``services.ai`` (the dict in
    # this module is dormant — nothing imports it). Lazy import keeps
    # ``services.ai``'s heavy LangChain deps off the hot path.
    from services.ai import _memory_vector_stores as _live_vector_stores
    from services.todo_service import get_todo_service

    cleared_vector_store = False
    if clear_long_term and session_id in _live_vector_stores:
        del _live_vector_stores[session_id]
        cleared_vector_store = True
        logger.info(f"[Memory] Cleared vector store for session '{session_id}'")

    todo_service = get_todo_service()
    cleared_todo_keys: List[str] = []
    seen = set()
    for key in (workflow_id, session_id, "default"):
        if key and key not in seen:
            seen.add(key)
            todo_service.clear(key)
            cleared_todo_keys.append(key)

    logger.info(
        "[Memory] Cleared agent session state session=%s workflow_id=%s "
        "vector_store=%s todo_keys=%s",
        session_id, workflow_id, cleared_vector_store, cleared_todo_keys,
    )

    return {
        "cleared_vector_store": cleared_vector_store,
        "cleared_todo_keys": cleared_todo_keys,
    }
