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

# All 16 Android services — migrated to nodes/android/*.py (Wave 11.C).


# ---------------------------------------------------------------------------
# 2. AI chat models (9) + memory + skill — model dispatch + accent colors
# ---------------------------------------------------------------------------

# All 9 chat models — migrated to nodes/model/*.py (Wave 11.C).

# simpleMemory + masterSkill — migrated to nodes/skill/*.py (Wave 11.C).


# ---------------------------------------------------------------------------
# 3. Messaging — WhatsApp, Telegram, Twitter, Email, Chat
# ---------------------------------------------------------------------------

register_node(type="whatsappSend",   metadata={"displayName": "WhatsApp Send",  "subtitle": "Send Message",      "icon": "asset:whatsapp-send", "color": "#25D366", "group": ["whatsapp", "tool"], "componentKind": "square", "handles": _IO, "description": "Send WhatsApp messages (text, media, location, contact, sticker)", "version": 1})
register_node(type="whatsappDb",     metadata={"displayName": "WhatsApp DB",    "subtitle": "Query DB",          "icon": "asset:whatsapp-db", "color": "#25D366", "group": ["whatsapp", "tool"], "componentKind": "square", "handles": _IO, "description": "Query WhatsApp database (chat history, contacts, groups, channels)", "version": 1})

# telegramSend — migrated to nodes/telegram/telegram_send.py (Wave 11.C).

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
# perplexitySearch — migrated to nodes/search/perplexity_search.py (Wave 11.C).

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
