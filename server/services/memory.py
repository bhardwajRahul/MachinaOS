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
