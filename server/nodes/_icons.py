"""Central registry of node icons.

Every node plugin imports its icon constant from here so a single
edit propagates to all references. Each constant's name is the
SCREAMING_SNAKE_CASE of the node's ``type`` field; the value is
whatever the icon resolver accepts (emoji, ``asset:foo``, or
``lobehub:Brand``).
"""

# agent
AI_EMPLOYEE = "👥"
AI_AGENT = "🤖"
ANDROID_AGENT = "📱"
AUTONOMOUS_AGENT = "🎯"
CHAT_AGENT = "✨"
CLAUDE_CODE_AGENT = "lobehub:Claude"
CODING_AGENT = "💻"
CONSUMER_AGENT = "🛒"
DEEP_AGENT = "🧠"
ORCHESTRATOR_AGENT = "🎼"
PAYMENTS_AGENT = "💳"
PRODUCTIVITY_AGENT = "⏰"
RLM_AGENT = "🧠"
SOCIAL_AGENT = "📱"
TASK_AGENT = "📋"
TOOL_AGENT = "🔧"
TRAVEL_AGENT = "✈️"
WEB_AGENT = "🌐"

# android
AIRPLANE_MODE_CONTROL = "✈️"
APP_LAUNCHER = "🚀"
APP_LIST = "📋"
AUDIO_AUTOMATION = "🔊"
BATTERY_MONITOR = "🔋"
BLUETOOTH_AUTOMATION = "🔵"
CAMERA_CONTROL = "📷"
DEVICE_STATE_AUTOMATION = "⚙️"
ENVIRONMENTAL_SENSORS = "🌡️"
LOCATION = "📍"
MEDIA_CONTROL = "🎵"
MOTION_DETECTION = "📳"
NETWORK_MONITOR = "📡"
SCREEN_CONTROL_AUTOMATION = "💡"
SYSTEM_INFO = "📱"
WIFI_AUTOMATION = "📶"

# browser
BROWSER = "asset:chrome"

# chat
CHAT_HISTORY = "asset:chat"
CHAT_SEND = "asset:chat"

# code
JAVASCRIPT_EXECUTOR = "asset:javascript"
PYTHON_EXECUTOR = "asset:python"
TYPESCRIPT_EXECUTOR = "asset:typescript"

# document
DOCUMENT_PARSER = "📄"
EMBEDDING_GENERATOR = "🧠"
FILE_DOWNLOADER = "⬇️"
HTTP_SCRAPER = "🔍"
TEXT_CHUNKER = "✂️"
VECTOR_STORE = "🗄️"

# email
EMAIL_READ = "asset:read"
EMAIL_RECEIVE = "asset:receive"
EMAIL_SEND = "asset:send"

# filesystem
FILE_MODIFY = "✏️"
FILE_READ = "📄"
FS_SEARCH = "🔍"
SHELL = "💻"

# google
CALENDAR = "asset:calendar"
CONTACTS = "asset:contacts"
DRIVE = "asset:drive"
GMAIL = "asset:gmail"
GMAIL_RECEIVE = "asset:gmail"
SHEETS = "asset:sheets"
TASKS = "asset:tasks"

# location
GMAPS_CREATE = "🗺️"
GMAPS_LOCATIONS = "🌍"
GMAPS_NEARBY_PLACES = "🔍"

# model
ANTHROPIC_CHAT_MODEL = "lobehub:claude"
CEREBRAS_CHAT_MODEL = "lobehub:cerebras"
DEEPSEEK_CHAT_MODEL = "lobehub:deepseek"
GEMINI_CHAT_MODEL = "lobehub:gemini"
GROQ_CHAT_MODEL = "lobehub:groq"
KIMI_CHAT_MODEL = "lobehub:kimi"
MISTRAL_CHAT_MODEL = "lobehub:mistral"
OPENAI_CHAT_MODEL = "lobehub:openai"
OPENROUTER_CHAT_MODEL = "lobehub:openrouter"

# proxy
PROXY_CONFIG = "🔧"
PROXY_REQUEST = "🛡️"
PROXY_STATUS = "📊"

# scheduler
CRON_SCHEDULER = "⏰"
TIMER = "⏱️"

# scraper
APIFY_ACTOR = "asset:apify"
CRAWLEE_SCRAPER = "🕷"

# search
BRAVE_SEARCH = "asset:brave"
DUCKDUCKGO_SEARCH = "asset:duckduckgo"
PERPLEXITY_SEARCH = "asset:perplexity"
SERPER_SEARCH = "asset:google"

# skill
MASTER_SKILL = "🎯"
SIMPLE_MEMORY = "🧠"

# social
SOCIAL_RECEIVE = "asset:social"
SOCIAL_SEND = "asset:social"

# telegram
TELEGRAM_RECEIVE = "asset:telegram"
TELEGRAM_SEND = "asset:telegram"

# text
FILE_HANDLER = "📁"
TEXT_GENERATOR = "📝"

# tool
CALCULATOR_TOOL = "🧮"
CURRENT_TIME_TOOL = "🕐"
TASK_MANAGER = "📋"
WRITE_TODOS = "📝"

# trigger
CHAT_TRIGGER = "asset:chat"
TASK_TRIGGER = "📬"
WEBHOOK_TRIGGER = "⚓"

# twitter
TWITTER_RECEIVE = "asset:x"
TWITTER_SEARCH = "asset:x"
TWITTER_SEND = "asset:x"
TWITTER_USER = "asset:x"

# utility
CONSOLE = "🖥️"
HTTP_REQUEST = "🌐"
PROCESS_MANAGER = "⚙️"
TEAM_MONITOR = "📊"
WEBHOOK_RESPONSE = "↩️"

# whatsapp
WHATSAPP_DB = "asset:whatsapp-db"
WHATSAPP_RECEIVE = "asset:whatsapp-receive"
WHATSAPP_SEND = "asset:whatsapp-send"

# workflow
START = "▶️"
