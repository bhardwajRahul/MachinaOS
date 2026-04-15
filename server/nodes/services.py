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

# whatsappSend + whatsappDb — migrated to nodes/whatsapp/*.py (Wave 11.C).
# telegramSend — migrated to nodes/telegram/telegram_send.py (Wave 11.C).

# twitterSend / twitterSearch / twitterUser — migrated to nodes/twitter/*.py (Wave 11.C).
# emailSend / emailRead — migrated to nodes/email/*.py (Wave 11.C).
# chatSend / chatHistory — migrated to nodes/chat/*.py (Wave 11.C).


# ---------------------------------------------------------------------------
# 4. Google Workspace (6) — branded blue
# ---------------------------------------------------------------------------

# All Google Workspace nodes — migrated to nodes/google/*.py (Wave 11.B/11.C).


# ---------------------------------------------------------------------------
# 5. Web — search, browser, scrapers, proxy, location
# ---------------------------------------------------------------------------

# All search nodes (brave / serper / perplexity) — migrated to nodes/search/*.py.

register_node(type="browser",          metadata={"displayName": "Browser",          "subtitle": "Browser Automation","icon": "asset:chrome", "color": "#ff79c6", "group": ["browser", "tool"], "componentKind": "square", "handles": _IO, "description": "Interactive browser automation via agent-browser CLI", "version": 1})
register_node(type="apifyActor",       metadata={"displayName": "Apify Actor",      "subtitle": "Web Scraper",      "icon": "asset:apify",  "color": "#ff79c6", "group": ["api", "scraper", "tool"], "componentKind": "square", "handles": _IO, "description": "Run Apify actors for Instagram, TikTok, Twitter, LinkedIn, etc.", "version": 1})
register_node(type="crawleeScraper",   metadata={"displayName": "Web Scraper",      "subtitle": "Crawlee",          "icon": "🕷", "color": "#ff79c6", "group": ["scraper", "tool"], "componentKind": "square", "handles": _IO, "description": "Web scraper supporting static HTML (BeautifulSoup) and JS-rendered (Playwright)", "version": 1})

register_node(type="proxyRequest",     metadata={"displayName": "Proxy Request",    "subtitle": "Routed HTTP",      "icon": "🛡", "color": "#ffb86c", "group": ["proxy"], "componentKind": "square", "handles": _IO, "description": "Make HTTP requests through residential proxy providers", "version": 1})
register_node(type="proxyConfig",      metadata={"displayName": "Proxy Config",     "subtitle": "Routing Rules",    "icon": "🔧", "color": "#ffb86c", "group": ["proxy", "tool"], "componentKind": "square", "handles": _IO, "description": "Configure proxy providers and routing rules", "version": 1})
register_node(type="proxyStatus",      metadata={"displayName": "Proxy Status",     "subtitle": "Health Stats",     "icon": "📊", "color": "#ffb86c", "group": ["proxy"], "componentKind": "square", "handles": _IO, "description": "View proxy provider health, scores, and usage statistics", "version": 1})

# All Maps nodes (gmaps_create / gmaps_locations / gmaps_nearby_places) —
# migrated to nodes/location/*.py (Wave 11.C).


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
