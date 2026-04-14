"""Per-node display metadata.

Receives the UI-only fields (``displayName``, ``icon``, ``group``,
``subtitle``, ``description``) that today live in the frontend
``client/src/nodeDefinitions/*.ts`` files. Wave 6 Phase 3 migrates each
node-definition file's display metadata into this dict; until then
NodeSpec falls back to the node type id for missing entries.

Single source of truth for everything the parameter panel + palette
needs to render a node header. Kept as a plain dict (not Pydantic) for
fast iteration during the migration — switch to a TypedDict / Pydantic
model once the schema stabilises.
"""

from typing import Any, Optional, TypedDict


class NodeMetadata(TypedDict, total=False):
    displayName: str
    icon: str
    group: list[str]
    subtitle: str
    description: str
    version: int
    # Wave 6: per-node UI panel hints lifted from the legacy frontend
    # INodeUIHints. Carries flags like isChatTrigger / isConsoleSink /
    # hasCodeEditor / isMemoryPanel / isToolPanel / etc. Empty dict when
    # the node doesn't need any panel-level toggles.
    uiHints: dict[str, object]


# Seeded incrementally per Wave 6 Phase 3 sub-commit. Sub-commit 3a
# covers utility + code + process + workflow groups (12 types). Later
# sub-commits add messaging (3b), agents/models (3c), and the rest.
# Source: client/src/nodeDefinitions/*.ts at the time of migration.
NODE_METADATA: dict[str, NodeMetadata] = {
    # Workflow group ---------------------------------------------------------
    "start": {
        "displayName": "Start",
        "icon": "▶",
        "group": ["workflow"],
        "description": "Starting point for workflow execution. Provides initial data to connected nodes.",
        "version": 1,
        "uiHints": {"hideInputSection": True, "hideOutputSection": True},
    },
    "taskTrigger": {
        "displayName": "Task Completed",
        "icon": "📨",
        "group": ["trigger", "workflow"],
        "description": "Triggers when a delegated child agent completes its task (success or error)",
        "version": 1,
    },
    # Utility group ----------------------------------------------------------
    "httpRequest": {
        "displayName": "HTTP Request",
        "icon": "🌐",
        "group": ["utility", "tool"],
        "description": "Make HTTP requests to external APIs",
        "version": 1,
    },
    "webhookTrigger": {
        "displayName": "Webhook Trigger",
        "icon": "🪝",
        "group": ["trigger"],
        "description": "Start workflow when HTTP request is received",
        "version": 1,
    },
    "webhookResponse": {
        "displayName": "Webhook Response",
        "icon": "↩️",
        "group": ["utility"],
        "description": "Send response back to webhook caller",
        "version": 1,
    },
    "chatTrigger": {
        "displayName": "Chat Trigger",
        "icon": "💬",
        "group": ["utility", "trigger"],
        "description": "Trigger workflow when user sends a chat message from the console input",
        "version": 1,
        "uiHints": {"isChatTrigger": True},
    },
    "console": {
        "displayName": "Console",
        "icon": "🖥️",
        "group": ["utility"],
        "description": "Log data to console panel for debugging during execution",
        "version": 1,
        "uiHints": {"isConsoleSink": True},
    },
    "teamMonitor": {
        "displayName": "Team Monitor",
        "icon": "📊",
        "group": ["utility", "agent"],
        "description": "Monitor agent team operations, tasks, and messages in real-time",
        "version": 1,
        "uiHints": {"hideInputSection": True, "hideOutputSection": True, "isMonitorPanel": True},
    },
    # Code group -------------------------------------------------------------
    "pythonExecutor": {
        "displayName": "Python Executor",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
        "group": ["code", "tool"],
        "description": "Execute Python code with input data access",
        "version": 1,
        "uiHints": {"hasCodeEditor": True},
    },
    "javascriptExecutor": {
        "displayName": "JavaScript Executor",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
        "group": ["code", "tool"],
        "description": "Execute JavaScript code with input data access",
        "version": 1,
        "uiHints": {"hasCodeEditor": True},
    },
    "typescriptExecutor": {
        "displayName": "TypeScript Executor",
        "icon": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
        "group": ["code", "tool"],
        "description": "Execute TypeScript code with input data access and type safety",
        "version": 1,
        "uiHints": {"hasCodeEditor": True},
    },
    # Process management -----------------------------------------------------
    "processManager": {
        "displayName": "Process Manager",
        "icon": "⚙️",
        "group": ["utility", "tool"],
        "description": "Start, stop, and manage long-running processes (dev servers, watchers, build tools). Streams output to Terminal tab.",
        "version": 1,
    },
    # Phase 3b: Messaging group ---------------------------------------------
    # Icons left blank for SVG-icon nodes - frontend resolves the SVG asset
    # via its own icon imports until we move SVG payload to the server too.
    "whatsappSend": {
        "displayName": "WhatsApp Send",
        "icon": "",
        "group": ["whatsapp", "tool"],
        "description": "Send WhatsApp messages (text, media, location, contact, sticker)",
        "version": 1,
    },
    "whatsappReceive": {
        "displayName": "WhatsApp Receive",
        "icon": "",
        "group": ["whatsapp", "trigger"],
        "description": "Trigger workflow when WhatsApp message is received",
        "version": 1,
    },
    "whatsappDb": {
        "displayName": "WhatsApp DB",
        "icon": "",
        "group": ["whatsapp", "tool"],
        "description": "Query WhatsApp database (chat history, contacts, groups, channels)",
        "version": 1,
    },
    "telegramSend": {
        "displayName": "Telegram Send",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Send text, photo, document, location, or contact messages via Telegram bot",
        "version": 1,
    },
    "telegramReceive": {
        "displayName": "Telegram Receive",
        "icon": "",
        "group": ["social", "trigger"],
        "description": "Trigger workflow when Telegram message is received",
        "version": 1,
    },
    "twitterSend": {
        "displayName": "Twitter Send",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Post tweets, reply, retweet, like, or delete tweets on Twitter/X",
        "version": 1,
    },
    "twitterReceive": {
        "displayName": "Twitter Receive",
        "icon": "",
        "group": ["social", "trigger"],
        "description": "Trigger workflow on Twitter mentions, search results, or timeline updates (polling-based)",
        "version": 1,
    },
    "twitterSearch": {
        "displayName": "Twitter Search",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Search recent tweets on Twitter/X using the Search API",
        "version": 1,
    },
    "twitterUser": {
        "displayName": "Twitter User",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Look up Twitter/X user profiles, followers, and following",
        "version": 1,
    },
    "socialReceive": {
        "displayName": "Social Receive",
        "icon": "",
        "group": ["social"],
        "description": "Unified receive trigger for any social platform (whatsapp, telegram, twitter, ...)",
        "version": 1,
    },
    "socialSend": {
        "displayName": "Social Send",
        "icon": "",
        "group": ["social", "tool"],
        "description": "Unified send action for any social platform",
        "version": 1,
    },
    # Phase 3c: Agents + chat models ----------------------------------------
    "aiAgent": {
        "displayName": "AI Agent",
        "icon": "🤖",
        "group": ["agent"],
        "description": "LangGraph agent with tool calling, memory, and iterative reasoning",
        "version": 1,
    },
    "chatAgent": {
        "displayName": "Zeenie",
        "icon": "🧞",
        "group": ["agent"],
        "description": "Conversational AI agent with memory and skill support",
        "version": 1,
    },
    "simpleMemory": {
        "displayName": "Simple Memory",
        "icon": "🧠",
        "group": ["tool", "memory"],
        "description": "Markdown-based conversation memory with optional vector long-term storage",
        "version": 1,
        "uiHints": {"isMemoryPanel": True, "hasCodeEditor": True, "hideRunButton": True},
    },
    "masterSkill": {
        "displayName": "Master Skill",
        "icon": "🎯",
        "group": ["tool"],
        "subtitle": "Skill Aggregator",
        "description": "Combine built-in and custom skills with enable/disable toggles",
        "version": 1,
        "uiHints": {
            "hideInputSection": True,
            "hideOutputSection": True,
            "hideRunButton": True,
            "isMasterSkillEditor": True,
            "hasCodeEditor": True,
        },
    },
    # Specialized agents (16) -- shared SpecializedAgentParams Pydantic model
    "android_agent": {
        "displayName": "Android Control Agent",
        "icon": "📱",
        "group": ["agent", "ai"],
        "description": "AI agent for Android device control",
        "version": 1,
    },
    "coding_agent": {
        "displayName": "Coding Agent",
        "icon": "💻",
        "group": ["agent", "ai"],
        "description": "AI agent for code execution",
        "version": 1,
    },
    "web_agent": {
        "displayName": "Web Control Agent",
        "icon": "🌐",
        "group": ["agent", "ai"],
        "description": "AI agent for web automation",
        "version": 1,
    },
    "task_agent": {
        "displayName": "Task Management Agent",
        "icon": "📋",
        "group": ["agent", "ai"],
        "description": "AI agent for task automation and scheduling",
        "version": 1,
    },
    "social_agent": {
        "displayName": "Social Media Agent",
        "icon": "📱",
        "group": ["agent", "ai"],
        "description": "AI agent for social messaging",
        "version": 1,
    },
    "travel_agent": {
        "displayName": "Travel Agent",
        "icon": "✈️",
        "group": ["agent", "ai"],
        "description": "AI agent for travel planning",
        "version": 1,
    },
    "tool_agent": {
        "displayName": "Tool Agent",
        "icon": "🔧",
        "group": ["agent", "ai"],
        "description": "AI agent for tool orchestration",
        "version": 1,
    },
    "productivity_agent": {
        "displayName": "Productivity Agent",
        "icon": "⏰",
        "group": ["agent", "ai"],
        "description": "AI agent for productivity workflows",
        "version": 1,
    },
    "payments_agent": {
        "displayName": "Payments Agent",
        "icon": "💳",
        "group": ["agent", "ai"],
        "description": "AI agent for payment processing",
        "version": 1,
    },
    "consumer_agent": {
        "displayName": "Consumer Agent",
        "icon": "🛒",
        "group": ["agent", "ai"],
        "description": "AI agent for consumer interactions",
        "version": 1,
    },
    "autonomous_agent": {
        "displayName": "Autonomous Agent",
        "icon": "🎯",
        "group": ["agent", "ai"],
        "description": "Autonomous agent using Code Mode patterns and agentic loops",
        "version": 1,
    },
    "orchestrator_agent": {
        "displayName": "Orchestrator Agent",
        "icon": "🎼",
        "group": ["agent", "ai"],
        "description": "Team-lead agent for coordinating multiple specialized agents",
        "version": 1,
    },
    "ai_employee": {
        "displayName": "AI Employee",
        "icon": "👥",
        "group": ["agent", "ai"],
        "description": "Team-lead agent for intelligent task delegation",
        "version": 1,
    },
    "rlm_agent": {
        "displayName": "RLM Agent",
        "icon": "🧠",
        "group": ["agent", "ai"],
        "description": "Recursive Language Model agent with REPL-based execution",
        "version": 1,
    },
    "claude_code_agent": {
        "displayName": "Claude Code Agent",
        "icon": ">_",
        "group": ["agent", "ai"],
        "description": "Claude Code SDK as a specialized agent node",
        "version": 1,
    },
    "deep_agent": {
        "displayName": "Deep Agent",
        "icon": "🧠",
        "group": ["agent", "ai"],
        "description": "LangChain DeepAgents with filesystem tools and sub-agent delegation",
        "version": 1,
    },
    # Chat models (9) -- shared AIChatModelParams Pydantic model.
    # Icons left blank so frontend can resolve provider SVG; group set to
    # ['model'] so Dashboard routing keeps SquareNode mapping.
    "openaiChatModel": {
        "displayName": "OpenAI",
        "icon": "",
        "group": ["model"],
        "description": "OpenAI GPT models with response format options",
        "version": 1,
    },
    "anthropicChatModel": {
        "displayName": "Anthropic Claude",
        "icon": "",
        "group": ["model"],
        "description": "Claude models with extended thinking support",
        "version": 1,
    },
    "geminiChatModel": {
        "displayName": "Google Gemini",
        "icon": "",
        "group": ["model"],
        "description": "Google Gemini models with multimodal and thinking support",
        "version": 1,
    },
    "openrouterChatModel": {
        "displayName": "OpenRouter",
        "icon": "",
        "group": ["model"],
        "description": "OpenRouter unified API for 200+ models",
        "version": 1,
    },
    "groqChatModel": {
        "displayName": "Groq",
        "icon": "",
        "group": ["model"],
        "description": "Groq ultra-fast inference (Llama, Qwen3, GPT-OSS)",
        "version": 1,
    },
    "cerebrasChatModel": {
        "displayName": "Cerebras",
        "icon": "",
        "group": ["model"],
        "description": "Cerebras ultra-fast inference on custom AI hardware",
        "version": 1,
    },
    "deepseekChatModel": {
        "displayName": "DeepSeek",
        "icon": "",
        "group": ["model"],
        "description": "DeepSeek V3 models (deepseek-chat, deepseek-reasoner)",
        "version": 1,
    },
    "kimiChatModel": {
        "displayName": "Kimi (Moonshot)",
        "icon": "",
        "group": ["model"],
        "description": "Kimi K2 models with thinking support",
        "version": 1,
    },
    "mistralChatModel": {
        "displayName": "Mistral",
        "icon": "",
        "group": ["model"],
        "description": "Mistral AI models (Large, Small, Codestral)",
        "version": 1,
    },
    # Phase 3d.i: Already-modeled types - location, scheduler, chat, text, ----
    # gmail trigger, and 16 Android service nodes.
    "gmaps_create": {
        "displayName": "GMaps Create",
        "icon": "🗺️",
        "group": ["location", "service"],
        "description": "Google Maps creation with customizable center, zoom, and map type",
        "version": 1,
        "uiHints": {"showLocationPanel": True},
    },
    "gmaps_locations": {
        "displayName": "GMaps Locations",
        "icon": "🌍",
        "group": ["location", "service", "tool"],
        "description": "Google Maps Geocoding service for address-to-coordinates conversion",
        "version": 1,
    },
    "gmaps_nearby_places": {
        "displayName": "GMaps Nearby Places",
        "icon": "🔍",
        "group": ["location", "service", "tool"],
        "description": "Google Places API nearbySearch with detailed place information",
        "version": 1,
    },
    "cronScheduler": {
        "displayName": "Cron Scheduler",
        "icon": "⏰",
        "group": ["trigger"],
        "description": "Schedule workflow execution using cron expressions",
        "version": 1,
    },
    "timer": {
        "displayName": "Timer",
        "icon": "⏱️",
        "group": ["trigger"],
        "description": "Trigger workflow on a fixed delay",
        "version": 1,
    },
    "chatSend": {
        "displayName": "Chat Send",
        "icon": "💬",
        "group": ["chat"],
        "description": "Send messages to chat conversations",
        "version": 1,
    },
    "chatHistory": {
        "displayName": "Chat History",
        "icon": "📜",
        "group": ["chat"],
        "description": "Retrieve chat conversation history",
        "version": 1,
    },
    "textGenerator": {
        "displayName": "Text Generator",
        "icon": "📝",
        "group": ["text"],
        "description": "Generate text content from templates",
        "version": 1,
    },
    "fileHandler": {
        "displayName": "File Handler",
        "icon": "📁",
        "group": ["text"],
        "description": "Read, write, and process files",
        "version": 1,
    },
    "gmailReceive": {
        "displayName": "Gmail Receive",
        "icon": "",
        "group": ["google", "trigger"],
        "description": "Polling trigger for incoming Gmail emails",
        "version": 1,
    },
    # Android service nodes (16) -- shared AndroidServiceParams Pydantic model
    "batteryMonitor": {
        "displayName": "Battery Monitor",
        "icon": "🔋",
        "group": ["android", "service"],
        "description": "Monitor battery status, level, charging state, temperature, and health",
        "version": 1,
    },
    "networkMonitor": {
        "displayName": "Network Monitor",
        "icon": "📡",
        "group": ["android", "service"],
        "description": "Monitor network connectivity status, type, and internet availability",
        "version": 1,
    },
    "systemInfo": {
        "displayName": "System Info",
        "icon": "📱",
        "group": ["android", "service"],
        "description": "Get device and OS information including Android version, API level, memory, and hardware details",
        "version": 1,
    },
    "location": {
        "displayName": "Location",
        "icon": "📍",
        "group": ["android", "service"],
        "description": "GPS location tracking with latitude, longitude, accuracy, and provider information",
        "version": 1,
    },
    "appLauncher": {
        "displayName": "App Launcher",
        "icon": "🚀",
        "group": ["android", "service"],
        "description": "Launch applications by package name",
        "version": 1,
    },
    "appList": {
        "displayName": "App List",
        "icon": "📋",
        "group": ["android", "service"],
        "description": "Get list of installed applications with package names, versions, and metadata",
        "version": 1,
    },
    "wifiAutomation": {
        "displayName": "WiFi Automation",
        "icon": "📶",
        "group": ["android", "service"],
        "description": "WiFi control and scanning - enable, disable, get status, scan for networks",
        "version": 1,
    },
    "bluetoothAutomation": {
        "displayName": "Bluetooth Automation",
        "icon": "🔵",
        "group": ["android", "service"],
        "description": "Bluetooth control - enable, disable, get status, and paired devices",
        "version": 1,
    },
    "audioAutomation": {
        "displayName": "Audio Automation",
        "icon": "🔊",
        "group": ["android", "service"],
        "description": "Volume and audio control - get/set volume, mute, unmute",
        "version": 1,
    },
    "deviceStateAutomation": {
        "displayName": "Device State",
        "icon": "⚙️",
        "group": ["android", "service"],
        "description": "Device state control - airplane mode, screen on/off, power save mode, brightness",
        "version": 1,
    },
    "screenControlAutomation": {
        "displayName": "Screen Control",
        "icon": "💡",
        "group": ["android", "service"],
        "description": "Screen control - brightness adjustment, wake screen, auto-brightness, screen timeout",
        "version": 1,
    },
    "airplaneModeControl": {
        "displayName": "Airplane Mode",
        "icon": "✈️",
        "group": ["android", "service"],
        "description": "Airplane mode status monitoring and control",
        "version": 1,
    },
    "motionDetection": {
        "displayName": "Motion Detection",
        "icon": "📳",
        "group": ["android", "service"],
        "description": "Accelerometer and gyroscope data - detect motion, shake gestures, device orientation",
        "version": 1,
    },
    "environmentalSensors": {
        "displayName": "Environmental Sensors",
        "icon": "🌡️",
        "group": ["android", "service"],
        "description": "Environmental sensors - temperature, humidity, pressure, light level",
        "version": 1,
    },
    "cameraControl": {
        "displayName": "Camera Control",
        "icon": "📷",
        "group": ["android", "service"],
        "description": "Camera control - get camera info, take photos, camera capabilities",
        "version": 1,
    },
    "mediaControl": {
        "displayName": "Media Control",
        "icon": "🎵",
        "group": ["android", "service"],
        "description": "Media playback control - volume control, playback control, play media files",
        "version": 1,
    },
    # Phase 3d.ii: 28 output-only types now have full input models + metadata
    # ------------------------------------------------------------------------
    # Search
    "braveSearch": {
        "displayName": "Brave Search",
        "icon": "",
        "group": ["search", "tool"],
        "description": "Search the web using Brave Search API",
        "version": 1,
    },
    "serperSearch": {
        "displayName": "Serper Search",
        "icon": "",
        "group": ["search", "tool"],
        "description": "Search the web using Google via Serper API (web/news/images/places)",
        "version": 1,
    },
    "perplexitySearch": {
        "displayName": "Perplexity Search",
        "icon": "",
        "group": ["search", "tool"],
        "description": "AI-powered search using Perplexity Sonar with citations",
        "version": 1,
    },
    # Browser / scraping
    "browser": {
        "displayName": "Browser",
        "icon": "",
        "group": ["browser", "tool"],
        "description": "Interactive browser automation via agent-browser CLI",
        "version": 1,
    },
    "crawleeScraper": {
        "displayName": "Web Scraper",
        "icon": "🕷",
        "group": ["scraper", "tool"],
        "description": "Web scraper supporting static HTML (BeautifulSoup) and JS-rendered (Playwright) modes",
        "version": 1,
    },
    "httpScraper": {
        "displayName": "HTTP Scraper",
        "icon": "🔍",
        "group": ["document"],
        "description": "Scrape links from web pages with date/page pagination support",
        "version": 1,
    },
    "apifyActor": {
        "displayName": "Apify Actor",
        "icon": "",
        "group": ["api", "scraper", "tool"],
        "description": "Run Apify actors for Instagram, TikTok, Twitter, LinkedIn, Facebook, YouTube, Google Search, etc.",
        "version": 1,
    },
    # Email
    "emailSend": {
        "displayName": "Email Send",
        "icon": "",
        "group": ["email", "tool"],
        "description": "Send emails via SMTP (Gmail, Outlook, Yahoo, iCloud, ProtonMail, Fastmail, custom)",
        "version": 1,
    },
    "emailRead": {
        "displayName": "Email Read",
        "icon": "",
        "group": ["email", "tool"],
        "description": "Read and manage emails via IMAP - list, search, read, move, delete, flag",
        "version": 1,
    },
    "emailReceive": {
        "displayName": "Email Receive",
        "icon": "",
        "group": ["email", "trigger"],
        "description": "Polling trigger for new emails via IMAP",
        "version": 1,
    },
    # Google Workspace
    "gmail": {
        "displayName": "Gmail",
        "icon": "",
        "group": ["google", "tool"],
        "description": "Gmail send / search / read operations",
        "version": 1,
    },
    "calendar": {
        "displayName": "Calendar",
        "icon": "",
        "group": ["google", "tool"],
        "description": "Google Calendar create / list / update / delete events",
        "version": 1,
    },
    "drive": {
        "displayName": "Drive",
        "icon": "",
        "group": ["google", "tool"],
        "description": "Google Drive upload / download / list / share files",
        "version": 1,
    },
    "sheets": {
        "displayName": "Sheets",
        "icon": "",
        "group": ["google", "tool"],
        "description": "Google Sheets read / write / append spreadsheet data",
        "version": 1,
    },
    "tasks": {
        "displayName": "Tasks",
        "icon": "",
        "group": ["google", "tool"],
        "description": "Google Tasks create / list / complete / update / delete",
        "version": 1,
    },
    "contacts": {
        "displayName": "Contacts",
        "icon": "",
        "group": ["google", "tool"],
        "description": "Google Contacts create / list / search / get / update / delete",
        "version": 1,
    },
    # Document / RAG
    "documentParser": {
        "displayName": "Document Parser",
        "icon": "📄",
        "group": ["document"],
        "description": "Parse documents to text (PyPDF, Marker GPU OCR, Unstructured, BeautifulSoup)",
        "version": 1,
    },
    "textChunker": {
        "displayName": "Text Chunker",
        "icon": "✂️",
        "group": ["document"],
        "description": "Split text into overlapping chunks for embedding",
        "version": 1,
    },
    "embeddingGenerator": {
        "displayName": "Embedding Generator",
        "icon": "🧠",
        "group": ["document"],
        "description": "Generate vector embeddings (HuggingFace local, OpenAI, Ollama)",
        "version": 1,
    },
    "vectorStore": {
        "displayName": "Vector Store",
        "icon": "🗄️",
        "group": ["document"],
        "description": "Store and query vector embeddings (ChromaDB, Qdrant, Pinecone)",
        "version": 1,
    },
    "fileDownloader": {
        "displayName": "File Downloader",
        "icon": "⬇️",
        "group": ["document"],
        "description": "Download files from URLs in parallel using semaphore-based concurrency",
        "version": 1,
    },
    # Filesystem
    "fileRead": {
        "displayName": "File Read",
        "icon": "📄",
        "group": ["filesystem", "tool"],
        "description": "Read file contents with line numbers and pagination",
        "version": 1,
    },
    "fileModify": {
        "displayName": "File Modify",
        "icon": "✏️",
        "group": ["filesystem", "tool"],
        "description": "Write new files or edit existing files with string replacement",
        "version": 1,
    },
    "fsSearch": {
        "displayName": "FS Search",
        "icon": "🔍",
        "group": ["filesystem", "tool"],
        "description": "Search the filesystem with ls / glob / grep modes",
        "version": 1,
    },
    "shell": {
        "displayName": "Shell",
        "icon": "💻",
        "group": ["filesystem", "tool"],
        "description": "Execute shell commands with timeout (sandboxed - no system PATH)",
        "version": 1,
    },
    # Proxy
    "proxyRequest": {
        "displayName": "Proxy Request",
        "icon": "🛡",
        "group": ["proxy"],
        "description": "Make HTTP requests through residential proxy providers with geo-targeting and failover",
        "version": 1,
    },
    "proxyConfig": {
        "displayName": "Proxy Config",
        "icon": "🔧",
        "group": ["proxy", "tool"],
        "description": "Configure proxy providers and routing rules",
        "version": 1,
    },
    "proxyStatus": {
        "displayName": "Proxy Status",
        "icon": "📊",
        "group": ["proxy"],
        "description": "View proxy provider health, scores, and usage statistics",
        "version": 1,
    },
}


def get_node_metadata(node_type: str) -> Optional[NodeMetadata]:
    """Return display metadata for a node type, or None if not seeded."""

    return NODE_METADATA.get(node_type)


def fallback_metadata(node_type: str) -> NodeMetadata:
    """Minimal metadata for a node type without a seeded entry. Keeps
    NodeSpec emission valid even before Phase 3 migrations land."""

    return {
        "displayName": node_type,
        "icon": "",
        "group": [],
        "description": "",
        "version": 1,
    }
