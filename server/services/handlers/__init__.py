"""Node handlers package - extracted from workflow.py for maintainability.

This package contains all node execution handlers organized by category:
- ai.py: AI Agent, AI Chat Model, Simple Memory
- android.py: Android Device Setup, Android Services
- code.py: Python Executor, JavaScript Executor
- document.py: HTTP Scraper, File Downloader, Document Parser, Text Chunker, Embedding Generator, Vector Store
- http.py: HTTP Request, Webhook Response
- tools.py: Tool execution handlers for AI Agent tool calling
- triggers.py: Generic trigger node handler
- utility.py: Maps, Text, Chat, Cron, Start
- whatsapp.py: WhatsApp Send, WhatsApp DB
- social.py: Social Receive, Social Send (unified messaging)
- polyglot.py: Polyglot server integration (standalone, not auto-imported)
"""

# AI handlers
from .ai import (
    handle_ai_agent,
    handle_chat_agent,
    handle_ai_chat_model,
    handle_simple_memory,
)

# Android handlers
from .android import (
    handle_android_service,
)

# Code execution handlers
from .code import (
    handle_python_executor,
    handle_javascript_executor,
    handle_typescript_executor,
)

# HTTP handlers
from .http import (
    handle_http_request,
    handle_webhook_response,
)

# Trigger handlers
from .triggers import (
    handle_trigger_node,
)

# Utility handlers
from .utility import (
    handle_create_map,
    handle_add_locations,
    handle_nearby_places,
    handle_text_generator,
    handle_file_handler,
    handle_chat_send,
    handle_chat_history,
    handle_start,
    handle_cron_scheduler,
    handle_timer,
    handle_console,
    handle_team_monitor,
)

# WhatsApp handlers
from .whatsapp import (
    handle_whatsapp_send,
    handle_whatsapp_db,
)

# Twitter handlers
from .twitter import (
    handle_twitter_send,
    handle_twitter_search,
    handle_twitter_user,
)

# Gmail handlers
from .gmail import (
    handle_gmail_send,
    handle_gmail_search,
    handle_gmail_read,
)

# Social handlers (unified messaging)
from .social import (
    handle_social_receive,
    handle_social_send,
)

# Document processing handlers
from .document import (
    handle_http_scraper,
    handle_file_downloader,
    handle_document_parser,
    handle_text_chunker,
    handle_embedding_generator,
    handle_vector_store,
)

# Search handlers
from .search import (
    handle_brave_search,
    handle_serper_search,
    handle_perplexity_search,
)

# Tool execution handlers (for AI Agent tool calling)
from .tools import (
    execute_tool,
    handle_task_manager,
)

__all__ = [
    # AI
    'handle_ai_agent',
    'handle_chat_agent',
    'handle_ai_chat_model',
    'handle_simple_memory',
    # Android
    'handle_android_service',
    # Code
    'handle_python_executor',
    'handle_javascript_executor',
    'handle_typescript_executor',
    # HTTP
    'handle_http_request',
    'handle_webhook_response',
    # Triggers
    'handle_trigger_node',
    # Utility
    'handle_create_map',
    'handle_add_locations',
    'handle_nearby_places',
    'handle_text_generator',
    'handle_file_handler',
    'handle_chat_send',
    'handle_chat_history',
    'handle_start',
    'handle_cron_scheduler',
    'handle_timer',
    'handle_console',
    'handle_team_monitor',
    # WhatsApp
    'handle_whatsapp_send',
    'handle_whatsapp_db',
    # Twitter
    'handle_twitter_send',
    'handle_twitter_search',
    'handle_twitter_user',
    # Gmail
    'handle_gmail_send',
    'handle_gmail_search',
    'handle_gmail_read',
    # Social
    'handle_social_receive',
    'handle_social_send',
    # Document processing
    'handle_http_scraper',
    'handle_file_downloader',
    'handle_document_parser',
    'handle_text_chunker',
    'handle_embedding_generator',
    'handle_vector_store',
    # Search
    'handle_brave_search',
    'handle_serper_search',
    'handle_perplexity_search',
    # Tools
    'execute_tool',
    'handle_task_manager',
]
