"""Centralized constants for node types and categories.

This module provides a single source of truth for all node type definitions,
eliminating duplicate string arrays across the codebase.
"""

from typing import FrozenSet

# =============================================================================
# AI NODE TYPES
# =============================================================================

AI_CHAT_MODEL_TYPES: FrozenSet[str] = frozenset([
    'openaiChatModel',
    'anthropicChatModel',
    'geminiChatModel',
    'openrouterChatModel',
    'groqChatModel',
    'cerebrasChatModel',
])

AI_AGENT_TYPES: FrozenSet[str] = frozenset([
    'aiAgent',
    'chatAgent',
    'android_agent',
    'coding_agent',
    'web_agent',
    'task_agent',
    'social_agent',
    'travel_agent',
    'tool_agent',
    'productivity_agent',
    'payments_agent',
    'consumer_agent',
])

AI_MEMORY_TYPES: FrozenSet[str] = frozenset([
    'simpleMemory',
])

# Tool node types (connect to AI Agent's input-tools handle)
AI_TOOL_TYPES: FrozenSet[str] = frozenset([
    'calculatorTool',
    'currentTimeTool',
    'webSearchTool',
    'androidTool',
])

# Skill node types (connect to Zeenie's input-skill handle)
# Skills provide SKILL.md context/instructions, not executed as workflow nodes
SKILL_NODE_TYPES: FrozenSet[str] = frozenset([
    'assistantPersonality',
    'whatsappSkill',
    'memorySkill',
    'mapsSkill',
    'httpSkill',
    'schedulerSkill',
    'androidSkill',
    'codeSkill',
    'customSkill',
])

# Toolkit node types (aggregate sub-nodes, n8n Sub-Node pattern)
# Sub-nodes connected to toolkits should not execute independently -
# they only execute when called via the toolkit's tool interface
TOOLKIT_NODE_TYPES: FrozenSet[str] = frozenset([
    'androidTool',  # Aggregates Android service nodes (batteryMonitor, location, etc.)
])

# All AI-related node types (for API key injection)
AI_MODEL_TYPES: FrozenSet[str] = AI_AGENT_TYPES | AI_CHAT_MODEL_TYPES

# =============================================================================
# CONFIG NODE TYPES (excluded from workflow execution)
# =============================================================================

# Config nodes provide configuration to other nodes via special handles
# (input-memory, input-tools, input-model, input-skill).
# They don't execute independently - they're used by their parent nodes.
CONFIG_NODE_TYPES: FrozenSet[str] = (
    AI_MEMORY_TYPES |    # Memory nodes (connect to input-memory)
    AI_TOOL_TYPES |      # Tool nodes (connect to AI Agent's input-tools)
    AI_CHAT_MODEL_TYPES |  # Model config nodes (connect to input-model)
    SKILL_NODE_TYPES     # Skill nodes (connect to Zeenie's input-skill)
)

# =============================================================================
# GOOGLE MAPS NODE TYPES
# =============================================================================

GOOGLE_MAPS_TYPES: FrozenSet[str] = frozenset([
    'gmaps_create',
    'gmaps_locations',
    'gmaps_nearby_places',
])

# =============================================================================
# ANDROID NODE TYPES
# =============================================================================

# System monitoring nodes
ANDROID_MONITORING_TYPES: FrozenSet[str] = frozenset([
    'batteryMonitor',
    'networkMonitor',
    'systemInfo',
    'location',
])

# App management nodes
ANDROID_APP_TYPES: FrozenSet[str] = frozenset([
    'appLauncher',
    'appList',
])

# Device automation nodes
ANDROID_AUTOMATION_TYPES: FrozenSet[str] = frozenset([
    'wifiAutomation',
    'bluetoothAutomation',
    'audioAutomation',
    'deviceStateAutomation',
    'screenControlAutomation',
    'airplaneModeControl',
])

# Sensor nodes
ANDROID_SENSOR_TYPES: FrozenSet[str] = frozenset([
    'motionDetection',
    'environmentalSensors',
])

# Media nodes
ANDROID_MEDIA_TYPES: FrozenSet[str] = frozenset([
    'cameraControl',
    'mediaControl',
])

# All Android service node types (combined)
ANDROID_SERVICE_NODE_TYPES: FrozenSet[str] = (
    ANDROID_MONITORING_TYPES |
    ANDROID_APP_TYPES |
    ANDROID_AUTOMATION_TYPES |
    ANDROID_SENSOR_TYPES |
    ANDROID_MEDIA_TYPES
)

# =============================================================================
# WHATSAPP NODE TYPES
# =============================================================================

WHATSAPP_TYPES: FrozenSet[str] = frozenset([
    'whatsappSend',
    'whatsappReceive',
    'whatsappDb',
])

# =============================================================================
# SOCIAL NODE TYPES (unified messaging)
# =============================================================================

SOCIAL_NODE_TYPES: FrozenSet[str] = frozenset([
    'socialReceive',
    'socialSend',
])

# Dual-purpose social nodes (workflow node + AI tool)
SOCIAL_TOOL_TYPES: FrozenSet[str] = frozenset([
    'socialSend',  # Can be used as AI Agent tool
])

# =============================================================================
# CHAT NODE TYPES
# =============================================================================

CHAT_TYPES: FrozenSet[str] = frozenset([
    'chatSend',
    'chatHistory',
])

# =============================================================================
# UTILITY NODE TYPES
# =============================================================================

CODE_EXECUTOR_TYPES: FrozenSet[str] = frozenset([
    'pythonExecutor',
    'javascriptExecutor',
])

HTTP_TYPES: FrozenSet[str] = frozenset([
    'httpRequest',
    'webhookResponse',
])

TEXT_TYPES: FrozenSet[str] = frozenset([
    'textGenerator',
    'fileHandler',
])

# =============================================================================
# WORKFLOW CONTROL NODE TYPES
# =============================================================================

WORKFLOW_CONTROL_TYPES: FrozenSet[str] = frozenset([
    'start',
    'cronScheduler',
])

# =============================================================================
# TRIGGER NODE TYPES (handled by event_waiter)
# =============================================================================

# Event-driven triggers that wait for external events
EVENT_TRIGGER_TYPES: FrozenSet[str] = frozenset([
    'webhookTrigger',
    'whatsappReceive',
    'workflowTrigger',
    'chatTrigger',
    'taskTrigger',
])

# Legacy alias for backwards compatibility
TRIGGER_TYPES: FrozenSet[str] = EVENT_TRIGGER_TYPES

# =============================================================================
# ALL TRIGGER NODE TYPES (starting points for workflow graphs)
# =============================================================================

# Combined set of all trigger node types that can start a workflow
# These nodes have no input handles and serve as entry points
WORKFLOW_TRIGGER_TYPES: FrozenSet[str] = frozenset([
    # Manual start
    'start',
    # Scheduled triggers
    'cronScheduler',
    # Event-driven triggers
    'webhookTrigger',
    'whatsappReceive',
    'workflowTrigger',
    'chatTrigger',
    'taskTrigger',
])

# =============================================================================
# AI PROVIDER DETECTION
# =============================================================================

def detect_ai_provider(node_type: str, parameters: dict = None) -> str:
    """Detect AI provider from node type or parameters.

    Args:
        node_type: The node type string
        parameters: Optional parameters dict (used for aiAgent/chatAgent)

    Returns:
        Provider string: 'openai', 'anthropic', 'gemini', 'openrouter', 'groq', or 'cerebras'
    """
    # AI Agent types get provider from parameters
    if node_type in AI_AGENT_TYPES:
        return (parameters or {}).get('provider', 'openai')
    elif 'cerebras' in node_type.lower():
        return 'cerebras'
    elif 'groq' in node_type.lower():
        return 'groq'
    elif 'openrouter' in node_type.lower():
        return 'openrouter'
    elif 'anthropic' in node_type.lower():
        return 'anthropic'
    elif 'gemini' in node_type.lower():
        return 'gemini'
    else:
        return 'openai'
