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
- gmail.py: Consolidated Gmail handler (send, search, read)
- calendar.py: Consolidated Calendar handler (create, list, update, delete)
- drive.py: Consolidated Drive handler (upload, download, list, share)
- sheets.py: Consolidated Sheets handler (read, write, append)
- tasks.py: Consolidated Tasks handler (create, list, complete, update, delete)
- contacts.py: Consolidated Contacts handler (create, list, search, get, update, delete)
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

# Google Workspace handlers inlined into nodes/google/*.py (Wave 11.D.4).

# Social handlers (unified messaging)
from .social import (
    handle_social_receive,
    handle_social_send,
)

# Document handlers inlined into nodes/document/*.py (Wave 11.D.7).

# Search handlers
from .search import (
    handle_brave_search,
    handle_serper_search,
    handle_perplexity_search,
)

# Email handlers (Himalaya CLI)
from .email import handle_email_send, handle_email_read, handle_email_receive

# Crawlee web scraping handler
from .crawlee import handle_crawlee_scraper

# Browser automation handler (agent-browser CLI)
from .browser import handle_browser

# RLM agent handler
from .rlm import handle_rlm_agent

# Deep Agent handler
from .deep_agent import handle_deep_agent

# Filesystem and shell handlers
from .filesystem import (
    handle_file_read,
    handle_file_modify,
    handle_shell,
    handle_fs_search,
)

# Tool execution handlers (for AI Agent tool calling)
from .tools import (
    execute_tool,
    handle_task_manager,
)

# Todo handler
from .todo import execute_write_todos, handle_write_todos

# Process manager handler
from .process import execute_process_manager, handle_process_manager

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
    # Social
    'handle_social_receive',
    'handle_social_send',
    # Search
    'handle_brave_search',
    'handle_serper_search',
    'handle_perplexity_search',
    # Crawlee
    'handle_crawlee_scraper',
    # RLM
    'handle_rlm_agent',
    # Deep Agent
    'handle_deep_agent',
    # Filesystem & Shell
    'handle_file_read',
    'handle_file_modify',
    'handle_shell',
    'handle_fs_search',
    # Email
    'handle_email_send',
    'handle_email_read',
    'handle_email_receive',
    # Tools
    'execute_tool',
    'handle_task_manager',
    # Todo
    'execute_write_todos',
    'handle_write_todos',
]
