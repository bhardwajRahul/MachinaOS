"""Service-node plugins (Wave 10.C batch 4 — bulk migration).

Migrates the remaining 72 entries from NODE_METADATA to the plugin
pattern: every node carries its own visual contract. Organized into
sections by family for skim-readability; each register_node call is
fully explicit (no group-based lookup, no shared color tables).

Sections:
  1. Android services (16)
  2. AI chat models + memory/skill (11)
  3. Messaging (WhatsApp, Telegram, Twitter, Email, Chat) — 12
  4. Google Workspace (6)
  5. Web (search, browser, apify, crawlee, proxy, location) — 11
  6. Data (filesystem, document, text) — 12
"""

from __future__ import annotations

from services.node_registry import register_node


# Standard square-node handles: input-main + output-main. Used by the
# vast majority of single-input/single-output square nodes below. Local
# to this module — not a global lookup.
_IO: list[dict] = [
    {"name": "input-main",  "kind": "input",  "position": "left",  "label": "Input",  "role": "main"},
    {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
]

# Output-only (model nodes connect upward to agents, no main I/O flow)
_MODEL_OUT: list[dict] = [
    {"name": "output-model", "kind": "output", "position": "right", "label": "Model", "role": "model"},
]


# ---------------------------------------------------------------------------
# 1. Android services (16) — green family, all SquareNode
# ---------------------------------------------------------------------------

_GREEN = "#50fa7b"

register_node(type="batteryMonitor",         metadata={"displayName": "Battery Monitor",         "icon": "🔋", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Monitor battery status, level, charging state, temperature, and health", "version": 1})
register_node(type="networkMonitor",         metadata={"displayName": "Network Monitor",         "icon": "📶", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Monitor network connectivity, type, and internet availability", "version": 1})
register_node(type="systemInfo",             metadata={"displayName": "System Info",             "icon": "🖥",  "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Get device and OS information", "version": 1})
register_node(type="location",               metadata={"displayName": "Location",                "icon": "📍", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "GPS location tracking with latitude, longitude, accuracy, and provider", "version": 1})
register_node(type="appLauncher",            metadata={"displayName": "App Launcher",            "icon": "🚀", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Launch applications by package name", "version": 1})
register_node(type="appList",                metadata={"displayName": "App List",                "icon": "📱", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Get list of installed applications", "version": 1})
register_node(type="wifiAutomation",         metadata={"displayName": "WiFi Automation",         "icon": "📡", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "WiFi control and scanning", "version": 1})
register_node(type="bluetoothAutomation",    metadata={"displayName": "Bluetooth Automation",    "icon": "🔵", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Bluetooth control - enable, disable, get status, paired devices", "version": 1})
register_node(type="audioAutomation",        metadata={"displayName": "Audio Automation",        "icon": "🔊", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Volume and audio control - get/set volume, mute, unmute", "version": 1})
register_node(type="deviceStateAutomation",  metadata={"displayName": "Device State",            "icon": "⚙️", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Device state control - airplane mode, screen on/off, brightness", "version": 1})
register_node(type="screenControlAutomation",metadata={"displayName": "Screen Control",          "icon": "💡", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Screen control - brightness, wake screen, auto-brightness", "version": 1})
register_node(type="airplaneModeControl",    metadata={"displayName": "Airplane Mode",           "icon": "✈️", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Airplane mode status monitoring and control", "version": 1})
register_node(type="motionDetection",        metadata={"displayName": "Motion Detection",        "icon": "🏃", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Accelerometer + gyroscope - motion, shake, orientation", "version": 1})
register_node(type="environmentalSensors",   metadata={"displayName": "Environmental Sensors",   "icon": "🌡", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Temperature, humidity, pressure, light level", "version": 1})
register_node(type="cameraControl",          metadata={"displayName": "Camera",                  "icon": "📷", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Camera control - get info, take photos, capabilities", "version": 1})
register_node(type="mediaControl",           metadata={"displayName": "Media Control",           "icon": "🎵", "color": _GREEN, "group": ["android", "service"], "componentKind": "square", "handles": _IO, "description": "Media playback - volume, playback, play files", "version": 1})


# ---------------------------------------------------------------------------
# 2. AI chat models (9) + memory + skill — model dispatch + accent colors
# ---------------------------------------------------------------------------

register_node(type="openaiChatModel",     metadata={"displayName": "OpenAI",      "subtitle": "Chat Model", "icon": "lobehub:openai",     "color": "#00A67E", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "OpenAI GPT models for chat completion and generation", "version": 1})
register_node(type="anthropicChatModel",  metadata={"displayName": "Claude",      "subtitle": "Chat Model", "icon": "lobehub:claude",     "color": "#FF6B35", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "Anthropic Claude models for conversation and analysis", "version": 1})
register_node(type="geminiChatModel",     metadata={"displayName": "Gemini",      "subtitle": "Chat Model", "icon": "lobehub:gemini",     "color": "#4285F4", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "Google Gemini models for multimodal AI capabilities", "version": 1})
register_node(type="openrouterChatModel", metadata={"displayName": "OpenRouter",  "subtitle": "Chat Model", "icon": "lobehub:openrouter", "color": "#6366F1", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "OpenRouter unified API - access OpenAI, Claude, Gemini, Llama, and more", "version": 1})
register_node(type="groqChatModel",       metadata={"displayName": "Groq",        "subtitle": "Chat Model", "icon": "lobehub:groq",       "color": "#F55036", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "Groq ultra-fast LLM inference (Llama, Qwen3, GPT-OSS)", "version": 1})
register_node(type="cerebrasChatModel",   metadata={"displayName": "Cerebras",    "subtitle": "Chat Model", "icon": "lobehub:cerebras",   "color": "#ffb86c", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "Cerebras ultra-fast inference on custom AI hardware", "version": 1})
register_node(type="deepseekChatModel",   metadata={"displayName": "DeepSeek",    "subtitle": "Chat Model", "icon": "lobehub:deepseek",   "color": "#8be9fd", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "DeepSeek V3 models (deepseek-chat, deepseek-reasoner with always-on CoT)", "version": 1})
register_node(type="kimiChatModel",       metadata={"displayName": "Kimi",        "subtitle": "Chat Model", "icon": "lobehub:kimi",       "color": "#bd93f9", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "Kimi K2 models by Moonshot AI with 256K context (thinking on by default)", "version": 1})
register_node(type="mistralChatModel",    metadata={"displayName": "Mistral",     "subtitle": "Chat Model", "icon": "lobehub:mistral",    "color": "#ffb86c", "group": ["model"], "componentKind": "model", "handles": _MODEL_OUT, "description": "Mistral AI models for reasoning, coding, and multilingual tasks", "version": 1})

register_node(
    type="simpleMemory",
    metadata={
        "displayName": "Simple Memory", "subtitle": "Conversation History",
        "icon": "💾", "color": "#f1fa8c",
        "group": ["tool", "memory"], "componentKind": "model",
        "handles": [{"name": "output-memory", "kind": "output", "position": "top", "label": "Memory", "role": "memory"}],
        "description": "Markdown-based conversation memory with optional vector DB",
        "version": 1,
        "uiHints": {"isMemoryPanel": True, "hasCodeEditor": True, "hideRunButton": True},
    },
)

register_node(
    type="masterSkill",
    metadata={
        "displayName": "Master Skill", "subtitle": "Skill Aggregator",
        "icon": "🎯", "color": "#f1fa8c",
        "group": ["tool"], "componentKind": "tool",
        "handles": [{"name": "output-skill", "kind": "output", "position": "top", "label": "Skill", "role": "skill"}],
        "description": "Aggregate multiple skills with enable/disable toggles",
        "version": 1,
        "uiHints": {"isToolPanel": True, "isMasterSkillEditor": True, "hideRunButton": True},
    },
)


# ---------------------------------------------------------------------------
# 3. Messaging — WhatsApp, Telegram, Twitter, Email, Chat
# ---------------------------------------------------------------------------

register_node(type="whatsappSend",   metadata={"displayName": "WhatsApp Send",  "subtitle": "Send Message",      "icon": "asset:whatsapp-send", "color": "#25D366", "group": ["whatsapp", "tool"], "componentKind": "square", "handles": _IO, "description": "Send WhatsApp messages (text, media, location, contact, sticker)", "version": 1})
register_node(type="whatsappDb",     metadata={"displayName": "WhatsApp DB",    "subtitle": "Query DB",          "icon": "asset:whatsapp-db", "color": "#25D366", "group": ["whatsapp", "tool"], "componentKind": "square", "handles": _IO, "description": "Query WhatsApp database (chat history, contacts, groups, channels)", "version": 1})

register_node(type="telegramSend",   metadata={"displayName": "Telegram Send",  "subtitle": "Send Message",      "icon": "asset:telegram", "color": "#0088CC", "group": ["social", "tool"], "componentKind": "square", "handles": _IO, "description": "Send text, photo, document, location, or contact via Telegram bot", "version": 1})

register_node(type="twitterSend",    metadata={"displayName": "Twitter Send",   "subtitle": "Tweet / Reply",     "icon": "asset:x", "color": "#1DA1F2", "group": ["social", "tool"], "componentKind": "square", "handles": _IO, "description": "Post tweets, reply, retweet, like, or delete tweets on Twitter/X", "version": 1})
register_node(type="twitterSearch",  metadata={"displayName": "Twitter Search", "subtitle": "Search Tweets",     "icon": "asset:x", "color": "#1DA1F2", "group": ["social", "tool"], "componentKind": "square", "handles": _IO, "description": "Search recent tweets on Twitter/X using the Search API", "version": 1})
register_node(type="twitterUser",    metadata={"displayName": "Twitter User",   "subtitle": "User Profiles",     "icon": "asset:x", "color": "#1DA1F2", "group": ["social", "tool"], "componentKind": "square", "handles": _IO, "description": "Look up Twitter/X user profiles, followers, and following", "version": 1})

register_node(type="emailSend",      metadata={"displayName": "Email Send",     "subtitle": "SMTP Outbound",     "icon": "asset:send", "color": "#8be9fd", "group": ["email", "tool"], "componentKind": "square", "handles": _IO, "description": "Send emails via SMTP (Gmail, Outlook, Yahoo, iCloud, ProtonMail, Fastmail, custom)", "version": 1})
register_node(type="emailRead",      metadata={"displayName": "Email Read",     "subtitle": "IMAP Read/Manage",  "icon": "asset:read", "color": "#8be9fd", "group": ["email", "tool"], "componentKind": "square", "handles": _IO, "description": "Read and manage emails via IMAP - list, search, read, move, delete, flag", "version": 1})

register_node(type="chatSend",       metadata={"displayName": "Chat Send",      "subtitle": "Send to Chat",      "icon": "asset:chat", "color": "#8be9fd", "group": ["chat"], "componentKind": "square", "handles": _IO, "description": "Send messages to chat conversations", "version": 1})
register_node(type="chatHistory",    metadata={"displayName": "Chat History",   "subtitle": "Retrieve Messages", "icon": "asset:chat", "color": "#8be9fd", "group": ["chat"], "componentKind": "square", "handles": _IO, "description": "Retrieve chat conversation history", "version": 1})


# ---------------------------------------------------------------------------
# 4. Google Workspace (6) — branded blue
# ---------------------------------------------------------------------------

# gmail — migrated to nodes/gmail.py (Wave 11.B class-based plugin).
register_node(type="calendar",  metadata={"displayName": "Calendar",  "subtitle": "Event Management",   "icon": "asset:calendar", "color": "#4285F4", "group": ["google", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Calendar create / list / update / delete events", "version": 1})
register_node(type="drive",     metadata={"displayName": "Drive",     "subtitle": "File Operations",    "icon": "asset:drive",    "color": "#0F9D58", "group": ["google", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Drive upload / download / list / share files", "version": 1})
register_node(type="sheets",    metadata={"displayName": "Sheets",    "subtitle": "Spreadsheet Ops",    "icon": "asset:sheets",   "color": "#0F9D58", "group": ["google", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Sheets read / write / append spreadsheet data", "version": 1})
register_node(type="tasks",     metadata={"displayName": "Tasks",     "subtitle": "Task Management",    "icon": "asset:tasks",    "color": "#4285F4", "group": ["google", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Tasks create / list / complete / update / delete", "version": 1})
register_node(type="contacts",  metadata={"displayName": "Contacts",  "subtitle": "Contact Management", "icon": "asset:contacts", "color": "#4285F4", "group": ["google", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Contacts create / list / search / get / update / delete", "version": 1})


# ---------------------------------------------------------------------------
# 5. Web — search, browser, scrapers, proxy, location
# ---------------------------------------------------------------------------

# braveSearch — migrated to nodes/brave_search.py (Wave 11.B class-based plugin).
register_node(type="serperSearch",     metadata={"displayName": "Serper Search",    "subtitle": "Google SERP",      "icon": "asset:google","color": "#ff79c6", "group": ["search", "tool"], "componentKind": "square", "handles": _IO, "description": "Search the web using Google via Serper API (web/news/images/places)", "version": 1})
register_node(type="perplexitySearch",  metadata={"displayName": "Perplexity Search","subtitle": "AI Search",       "icon": "asset:perplexity",  "color": "#ff79c6", "group": ["search", "tool"], "componentKind": "square", "handles": _IO, "description": "AI-powered search using Perplexity Sonar with citations", "version": 1})

register_node(type="browser",          metadata={"displayName": "Browser",          "subtitle": "Browser Automation","icon": "asset:chrome", "color": "#ff79c6", "group": ["browser", "tool"], "componentKind": "square", "handles": _IO, "description": "Interactive browser automation via agent-browser CLI", "version": 1})
register_node(type="apifyActor",       metadata={"displayName": "Apify Actor",      "subtitle": "Web Scraper",      "icon": "asset:apify",  "color": "#ff79c6", "group": ["api", "scraper", "tool"], "componentKind": "square", "handles": _IO, "description": "Run Apify actors for Instagram, TikTok, Twitter, LinkedIn, etc.", "version": 1})
register_node(type="crawleeScraper",   metadata={"displayName": "Web Scraper",      "subtitle": "Crawlee",          "icon": "🕷", "color": "#ff79c6", "group": ["scraper", "tool"], "componentKind": "square", "handles": _IO, "description": "Web scraper supporting static HTML (BeautifulSoup) and JS-rendered (Playwright)", "version": 1})

register_node(type="proxyRequest",     metadata={"displayName": "Proxy Request",    "subtitle": "Routed HTTP",      "icon": "🛡", "color": "#ffb86c", "group": ["proxy"], "componentKind": "square", "handles": _IO, "description": "Make HTTP requests through residential proxy providers", "version": 1})
register_node(type="proxyConfig",      metadata={"displayName": "Proxy Config",     "subtitle": "Routing Rules",    "icon": "🔧", "color": "#ffb86c", "group": ["proxy", "tool"], "componentKind": "square", "handles": _IO, "description": "Configure proxy providers and routing rules", "version": 1})
register_node(type="proxyStatus",      metadata={"displayName": "Proxy Status",     "subtitle": "Health Stats",     "icon": "📊", "color": "#ffb86c", "group": ["proxy"], "componentKind": "square", "handles": _IO, "description": "View proxy provider health, scores, and usage statistics", "version": 1})

register_node(type="gmaps_create",         metadata={"displayName": "Map Create",      "subtitle": "Google Map",     "icon": "🗺️", "color": _GREEN, "group": ["location", "service"],         "componentKind": "square", "handles": _IO, "description": "Google Maps creation with center, zoom, and map type", "version": 1, "uiHints": {"showLocationPanel": True}})
register_node(type="gmaps_locations",      metadata={"displayName": "Geocoding",       "subtitle": "Address → LatLng","icon": "📍", "color": _GREEN, "group": ["location", "service", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Maps Geocoding service", "version": 1})
register_node(type="gmaps_nearby_places",  metadata={"displayName": "Nearby Places",   "subtitle": "Places API",     "icon": "🏪", "color": _GREEN, "group": ["location", "service", "tool"], "componentKind": "square", "handles": _IO, "description": "Google Places API nearbySearch", "version": 1})


# ---------------------------------------------------------------------------
# 6. Data — filesystem, document, text
# ---------------------------------------------------------------------------

register_node(type="fileRead",          metadata={"displayName": "File Read",        "subtitle": "Read Contents",  "icon": "📖", "color": "#8be9fd", "group": ["filesystem", "tool"], "componentKind": "square", "handles": _IO, "description": "Read file contents with line numbers and pagination", "version": 1})
register_node(type="fileModify",        metadata={"displayName": "File Modify",      "subtitle": "Write/Edit",     "icon": "✏️", "color": "#8be9fd", "group": ["filesystem", "tool"], "componentKind": "square", "handles": _IO, "description": "Write new files or edit existing files", "version": 1})
register_node(type="shell",             metadata={"displayName": "Shell",            "subtitle": "Run Command",    "icon": "$_", "color": "#8be9fd", "group": ["filesystem", "tool"], "componentKind": "square", "handles": _IO, "description": "Execute shell commands (sandboxed; no system PATH)", "version": 1})
register_node(type="fsSearch",          metadata={"displayName": "FS Search",        "subtitle": "ls/glob/grep",   "icon": "🔍", "color": "#8be9fd", "group": ["filesystem", "tool"], "componentKind": "square", "handles": _IO, "description": "Search the filesystem (ls, glob, grep)", "version": 1})

register_node(type="httpScraper",       metadata={"displayName": "HTTP Scraper",     "subtitle": "Page Pagination","icon": "🔍", "color": "#bd93f9", "group": ["document"],            "componentKind": "square", "handles": _IO, "description": "Scrape links from web pages with date/page pagination support", "version": 1})
register_node(type="fileDownloader",    metadata={"displayName": "File Downloader",  "subtitle": "Parallel DL",   "icon": "⬇️", "color": "#bd93f9", "group": ["document"],            "componentKind": "square", "handles": _IO, "description": "Download files from URLs in parallel", "version": 1})
register_node(type="documentParser",    metadata={"displayName": "Document Parser",  "subtitle": "Parse to Text", "icon": "📄", "color": "#bd93f9", "group": ["document"],            "componentKind": "square", "handles": _IO, "description": "Parse documents to text using configurable parsers", "version": 1})
register_node(type="textChunker",       metadata={"displayName": "Text Chunker",     "subtitle": "Chunk Text",    "icon": "✂️", "color": "#bd93f9", "group": ["document"],            "componentKind": "square", "handles": _IO, "description": "Split text into overlapping chunks for embedding", "version": 1})
register_node(type="embeddingGenerator",metadata={"displayName": "Embedding Generator","subtitle": "Vectorize",   "icon": "🧮", "color": "#bd93f9", "group": ["document"],            "componentKind": "square", "handles": _IO, "description": "Generate vector embeddings from text chunks", "version": 1})
register_node(type="vectorStore",       metadata={"displayName": "Vector Store",     "subtitle": "Store/Query",   "icon": "🗄", "color": "#bd93f9", "group": ["document"],            "componentKind": "square", "handles": _IO, "description": "Store and query vector embeddings", "version": 1})

register_node(type="fileHandler",       metadata={"displayName": "File Handler",     "subtitle": "Read/Write Files", "icon": "📁", "color": "#bd93f9", "group": ["text"],               "componentKind": "square", "handles": _IO, "description": "Read, write, and process files", "version": 1})
register_node(type="textGenerator",     metadata={"displayName": "Text Generator",   "subtitle": "Static / AI Text", "icon": "📝", "color": "#bd93f9", "group": ["text"],               "componentKind": "square", "handles": _IO, "description": "Generate text using static, AI, file, or API source", "version": 1})
