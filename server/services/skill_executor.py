"""Skill executor service for executing skill tools via node handlers.

Maps skill tool names to existing node handlers, enabling Chat Agent
to use skills that leverage the existing workflow node infrastructure.
"""

import json
from typing import Dict, Any, List, Optional, Callable, Type, TYPE_CHECKING
from dataclasses import dataclass
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool
from core.logging import get_logger

if TYPE_CHECKING:
    from services.skill_loader import SkillLoader

logger = get_logger(__name__)


# =============================================================================
# TOOL SCHEMA DEFINITIONS
# =============================================================================

class WhatsAppSendSchema(BaseModel):
    """Schema for WhatsApp send tool."""
    phone_number: str = Field(description="Recipient phone number with country code (e.g., +1234567890)")
    message: str = Field(description="Message text to send")


class WhatsAppStatusSchema(BaseModel):
    """Schema for WhatsApp status tool."""
    pass  # No parameters needed


class MemorySaveSchema(BaseModel):
    """Schema for memory save tool."""
    key: str = Field(description="Identifier for the memory entry")
    value: str = Field(description="Information to remember")
    session_id: Optional[str] = Field(default=None, description="Session for organization")


class MemoryGetSchema(BaseModel):
    """Schema for memory get tool."""
    key: str = Field(description="Identifier to look up")
    session_id: Optional[str] = Field(default=None, description="Specific session to search")


class MemoryClearSchema(BaseModel):
    """Schema for memory clear tool."""
    key: Optional[str] = Field(default=None, description="Specific key to clear, or all if not specified")
    session_id: Optional[str] = Field(default=None, description="Specific session to clear")


class MapsGeocodeSchema(BaseModel):
    """Schema for maps geocode tool."""
    address: str = Field(description="Address or location name to geocode")


class MapsNearbySchema(BaseModel):
    """Schema for maps nearby places tool."""
    location: str = Field(description="Center point (address or 'lat,lng')")
    type: str = Field(description="Place type (restaurant, cafe, hospital, etc.)")
    radius: int = Field(default=1000, description="Search radius in meters")


class MapsCreateSchema(BaseModel):
    """Schema for maps create tool."""
    center: str = Field(description="Map center (address or 'lat,lng')")
    zoom: int = Field(default=14, description="Zoom level 1-20")


class HttpRequestSchema(BaseModel):
    """Schema for HTTP request tool."""
    url: str = Field(description="Full URL to request")
    method: str = Field(default="GET", description="HTTP method (GET, POST, PUT, DELETE, PATCH)")
    body: Optional[Dict[str, Any]] = Field(default=None, description="Request body as JSON object")
    headers: Optional[Dict[str, str]] = Field(default=None, description="Custom headers")


class SchedulerTimerSchema(BaseModel):
    """Schema for scheduler timer tool."""
    duration: str = Field(description="Time until execution (e.g., '5m', '1h', '30s')")
    action: str = Field(description="What to do when timer fires")
    name: Optional[str] = Field(default=None, description="Timer identifier")


class SchedulerCronSchema(BaseModel):
    """Schema for scheduler cron tool."""
    expression: str = Field(description="Cron expression (e.g., '0 9 * * *')")
    action: str = Field(description="What to do on each trigger")
    name: Optional[str] = Field(default=None, description="Schedule identifier")
    timezone: str = Field(default="UTC", description="Timezone for schedule")


class SchedulerListSchema(BaseModel):
    """Schema for scheduler list tool."""
    pass  # No parameters needed


class SchedulerCancelSchema(BaseModel):
    """Schema for scheduler cancel tool."""
    name: str = Field(description="Name of schedule to cancel")


class AndroidBatterySchema(BaseModel):
    """Schema for Android battery tool."""
    action: str = Field(default="status", description="Action to perform")


class AndroidWifiSchema(BaseModel):
    """Schema for Android WiFi tool."""
    action: str = Field(description="Action: status, enable, disable, scan")


class AndroidBluetoothSchema(BaseModel):
    """Schema for Android Bluetooth tool."""
    action: str = Field(description="Action: status, enable, disable, paired_devices")


class AndroidAppsSchema(BaseModel):
    """Schema for Android apps tool."""
    action: str = Field(description="Action: list, launch")
    package_name: Optional[str] = Field(default=None, description="App package name (for launch)")


class AndroidLocationSchema(BaseModel):
    """Schema for Android location tool."""
    action: str = Field(default="current", description="Action to perform")


class AndroidAudioSchema(BaseModel):
    """Schema for Android audio tool."""
    action: str = Field(description="Action: get_volume, set_volume, mute, unmute")
    volume: Optional[int] = Field(default=None, description="Volume level 0-100 (for set_volume)")


class AndroidScreenSchema(BaseModel):
    """Schema for Android screen tool."""
    action: str = Field(description="Action: brightness, set_brightness, wake, sleep")
    level: Optional[int] = Field(default=None, description="Brightness level 0-255 (for set_brightness)")


class AndroidCameraSchema(BaseModel):
    """Schema for Android camera tool."""
    action: str = Field(description="Action: info, capture")
    camera: str = Field(default="back", description="Camera: front or back")


class AndroidSensorsSchema(BaseModel):
    """Schema for Android sensors tool."""
    action: str = Field(description="Action: motion, environment")


class CodePythonSchema(BaseModel):
    """Schema for Python code execution tool."""
    code: str = Field(description="Python code to execute")
    input_data: Optional[Any] = Field(default=None, description="Data to pass to the script")


class CodeJavaScriptSchema(BaseModel):
    """Schema for JavaScript code execution tool."""
    code: str = Field(description="JavaScript code to execute")
    input_data: Optional[Any] = Field(default=None, description="Data to pass to the script")


# =============================================================================
# TOOL REGISTRY
# =============================================================================

@dataclass
class ToolConfig:
    """Configuration for a skill tool."""
    name: str
    description: str
    schema: Type[BaseModel]
    handler_type: str  # Node type or special handler name
    handler_params: Dict[str, Any] = None  # Additional params for handler


# Map tool names to configurations
TOOL_REGISTRY: Dict[str, ToolConfig] = {
    # WhatsApp tools
    'whatsapp-send': ToolConfig(
        name='whatsapp-send',
        description='Send a WhatsApp message to a phone number',
        schema=WhatsAppSendSchema,
        handler_type='whatsappSend'
    ),
    'whatsapp-status': ToolConfig(
        name='whatsapp-status',
        description='Check WhatsApp connection status',
        schema=WhatsAppStatusSchema,
        handler_type='whatsappConnect'
    ),

    # Memory tools
    'memory-save': ToolConfig(
        name='memory-save',
        description='Save information to long-term memory',
        schema=MemorySaveSchema,
        handler_type='memory_save'
    ),
    'memory-get': ToolConfig(
        name='memory-get',
        description='Retrieve saved information from memory',
        schema=MemoryGetSchema,
        handler_type='memory_get'
    ),
    'memory-clear': ToolConfig(
        name='memory-clear',
        description='Clear memory entries',
        schema=MemoryClearSchema,
        handler_type='memory_clear'
    ),

    # Maps tools
    'maps-geocode': ToolConfig(
        name='maps-geocode',
        description='Convert an address to geographic coordinates',
        schema=MapsGeocodeSchema,
        handler_type='addLocations'
    ),
    'maps-nearby': ToolConfig(
        name='maps-nearby',
        description='Search for nearby places',
        schema=MapsNearbySchema,
        handler_type='showNearbyPlaces'
    ),
    'maps-create': ToolConfig(
        name='maps-create',
        description='Create an interactive map',
        schema=MapsCreateSchema,
        handler_type='createMap'
    ),

    # HTTP tools
    'http-request': ToolConfig(
        name='http-request',
        description='Make an HTTP request to a URL',
        schema=HttpRequestSchema,
        handler_type='httpRequest'
    ),

    # Scheduler tools
    'scheduler-timer': ToolConfig(
        name='scheduler-timer',
        description='Set a one-time timer',
        schema=SchedulerTimerSchema,
        handler_type='timer'
    ),
    'scheduler-cron': ToolConfig(
        name='scheduler-cron',
        description='Create a recurring schedule using cron expression',
        schema=SchedulerCronSchema,
        handler_type='cronScheduler'
    ),
    'scheduler-list': ToolConfig(
        name='scheduler-list',
        description='List all active schedules and timers',
        schema=SchedulerListSchema,
        handler_type='scheduler_list'
    ),
    'scheduler-cancel': ToolConfig(
        name='scheduler-cancel',
        description='Cancel a scheduled task',
        schema=SchedulerCancelSchema,
        handler_type='scheduler_cancel'
    ),

    # Android tools
    'android-battery': ToolConfig(
        name='android-battery',
        description='Get Android device battery information',
        schema=AndroidBatterySchema,
        handler_type='batteryMonitor'
    ),
    'android-wifi': ToolConfig(
        name='android-wifi',
        description='Control Android WiFi settings',
        schema=AndroidWifiSchema,
        handler_type='wifiAutomation'
    ),
    'android-bluetooth': ToolConfig(
        name='android-bluetooth',
        description='Control Android Bluetooth settings',
        schema=AndroidBluetoothSchema,
        handler_type='bluetoothAutomation'
    ),
    'android-apps': ToolConfig(
        name='android-apps',
        description='Manage Android applications',
        schema=AndroidAppsSchema,
        handler_type='appLauncher'
    ),
    'android-location': ToolConfig(
        name='android-location',
        description='Get Android device location',
        schema=AndroidLocationSchema,
        handler_type='location'
    ),
    'android-audio': ToolConfig(
        name='android-audio',
        description='Control Android audio settings',
        schema=AndroidAudioSchema,
        handler_type='audioAutomation'
    ),
    'android-screen': ToolConfig(
        name='android-screen',
        description='Control Android screen settings',
        schema=AndroidScreenSchema,
        handler_type='screenControlAutomation'
    ),
    'android-camera': ToolConfig(
        name='android-camera',
        description='Access Android camera',
        schema=AndroidCameraSchema,
        handler_type='cameraControl'
    ),
    'android-sensors': ToolConfig(
        name='android-sensors',
        description='Read Android sensor data',
        schema=AndroidSensorsSchema,
        handler_type='environmentalSensors'
    ),

    # Code tools
    'code-python': ToolConfig(
        name='code-python',
        description='Execute Python code',
        schema=CodePythonSchema,
        handler_type='pythonExecutor'
    ),
    'code-javascript': ToolConfig(
        name='code-javascript',
        description='Execute JavaScript code',
        schema=CodeJavaScriptSchema,
        handler_type='javascriptExecutor'
    ),
}


class SkillExecutor:
    """Executes skill tools by delegating to node handlers."""

    def __init__(self, skill_loader: "SkillLoader", node_executor, database=None):
        """Initialize skill executor.

        Args:
            skill_loader: SkillLoader instance for loading skill instructions
            node_executor: NodeExecutor or function to execute node handlers
            database: Database instance for memory operations
        """
        self.skill_loader = skill_loader
        self.node_executor = node_executor
        self.database = database

    async def execute_tool(self, tool_name: str, args: Dict[str, Any],
                           context: Dict[str, Any] = None) -> Any:
        """Execute a skill tool by name.

        Args:
            tool_name: Name of the tool to execute
            args: Arguments for the tool
            context: Optional execution context

        Returns:
            Tool execution result
        """
        if tool_name not in TOOL_REGISTRY:
            raise ValueError(f"Unknown tool: {tool_name}")

        config = TOOL_REGISTRY[tool_name]
        handler_type = config.handler_type

        logger.info(f"[SkillExecutor] Executing tool: {tool_name} -> {handler_type}")

        # Special handlers for memory operations
        if handler_type == 'memory_save':
            return await self._handle_memory_save(args)
        elif handler_type == 'memory_get':
            return await self._handle_memory_get(args)
        elif handler_type == 'memory_clear':
            return await self._handle_memory_clear(args)
        elif handler_type == 'scheduler_list':
            return await self._handle_scheduler_list()
        elif handler_type == 'scheduler_cancel':
            return await self._handle_scheduler_cancel(args)

        # Map args to node parameters
        parameters = self._map_args_to_parameters(tool_name, args)

        # Execute via node executor
        result = await self.node_executor(
            node_id=f"skill_{tool_name}",
            node_type=handler_type,
            parameters=parameters,
            context=context or {}
        )

        return result

    def _map_args_to_parameters(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Map tool arguments to node parameters.

        Different tools may need different parameter mappings to match
        the expected format of their underlying node handlers.
        """
        # WhatsApp send
        if tool_name == 'whatsapp-send':
            return {
                'phoneNumber': args.get('phone_number'),
                'message': args.get('message')
            }

        # HTTP request - serialize headers and body to JSON strings (handler expects JSON strings)
        if tool_name == 'http-request':
            headers = args.get('headers')
            body = args.get('body')
            return {
                'url': args.get('url'),
                'method': args.get('method', 'GET'),
                'body': json.dumps(body) if isinstance(body, dict) else (body or ''),
                'headers': json.dumps(headers) if isinstance(headers, dict) else (headers or '{}'),
                'timeout': 30
            }

        # Maps geocode
        if tool_name == 'maps-geocode':
            return {
                'addresses': [args.get('address')]
            }

        # Maps nearby
        if tool_name == 'maps-nearby':
            return {
                'location': args.get('location'),
                'type': args.get('type'),
                'radius': args.get('radius', 1000)
            }

        # Maps create
        if tool_name == 'maps-create':
            return {
                'center': args.get('center'),
                'zoom': args.get('zoom', 14)
            }

        # Scheduler timer
        if tool_name == 'scheduler-timer':
            return {
                'duration': args.get('duration'),
                'action': args.get('action'),
                'name': args.get('name')
            }

        # Scheduler cron
        if tool_name == 'scheduler-cron':
            return {
                'expression': args.get('expression'),
                'action': args.get('action'),
                'name': args.get('name'),
                'timezone': args.get('timezone', 'UTC')
            }

        # Android tools - pass action directly
        if tool_name.startswith('android-'):
            return args

        # Code execution
        if tool_name in ('code-python', 'code-javascript'):
            return {
                'code': args.get('code'),
                'input_data': args.get('input_data')
            }

        # Default: pass through
        return args

    async def _handle_memory_save(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle memory save operation."""
        if not self.database:
            return {"success": False, "error": "Database not available"}

        key = args.get('key')
        value = args.get('value')
        session_id = args.get('session_id', 'skill_memory')

        try:
            # Use conversation message storage for persistence
            await self.database.add_conversation_message(
                session_id=f"memory_{session_id}_{key}",
                role='memory',
                content=value
            )
            return {"success": True, "key": key, "saved": True}
        except Exception as e:
            logger.error(f"[SkillExecutor] Memory save failed: {e}")
            return {"success": False, "error": str(e)}

    async def _handle_memory_get(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle memory get operation."""
        if not self.database:
            return {"success": False, "error": "Database not available"}

        key = args.get('key')
        session_id = args.get('session_id', 'skill_memory')

        try:
            messages = await self.database.get_conversation_messages(
                session_id=f"memory_{session_id}_{key}",
                limit=1
            )
            if messages:
                return {"success": True, "key": key, "value": messages[-1].get('content')}
            return {"success": True, "key": key, "value": None, "found": False}
        except Exception as e:
            logger.error(f"[SkillExecutor] Memory get failed: {e}")
            return {"success": False, "error": str(e)}

    async def _handle_memory_clear(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle memory clear operation."""
        if not self.database:
            return {"success": False, "error": "Database not available"}

        key = args.get('key')
        session_id = args.get('session_id', 'skill_memory')

        try:
            if key:
                count = await self.database.clear_conversation(f"memory_{session_id}_{key}")
            else:
                # Clear all memory for session - would need pattern matching
                count = 0
            return {"success": True, "cleared": count}
        except Exception as e:
            logger.error(f"[SkillExecutor] Memory clear failed: {e}")
            return {"success": False, "error": str(e)}

    async def _handle_scheduler_list(self) -> Dict[str, Any]:
        """Handle scheduler list operation."""
        # This would integrate with the deployment manager's cron tracking
        return {"success": True, "schedules": [], "message": "Scheduler list not yet implemented"}

    async def _handle_scheduler_cancel(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle scheduler cancel operation."""
        name = args.get('name')
        return {"success": True, "cancelled": name, "message": "Scheduler cancel not yet implemented"}

    def build_tools_for_skills(self, skill_names: List[str]) -> List[StructuredTool]:
        """Build LangChain StructuredTools for the given skills.

        Args:
            skill_names: List of skill names to build tools for

        Returns:
            List of LangChain StructuredTool instances
        """
        tools = []

        for skill_name in skill_names:
            skill = self.skill_loader.load_skill(skill_name)
            if not skill:
                logger.warning(f"[SkillExecutor] Skill not found: {skill_name}")
                continue

            # Get allowed tools for this skill
            for tool_name in skill.metadata.allowed_tools:
                if tool_name not in TOOL_REGISTRY:
                    logger.warning(f"[SkillExecutor] Unknown tool in skill {skill_name}: {tool_name}")
                    continue

                config = TOOL_REGISTRY[tool_name]

                # Create placeholder function (actual execution via execute_tool)
                def make_placeholder(tn):
                    def placeholder(**kwargs):
                        return {"tool_name": tn, "args": kwargs}
                    return placeholder

                tool = StructuredTool.from_function(
                    name=tool_name.replace('-', '_'),  # LangChain prefers underscores
                    description=config.description,
                    func=make_placeholder(tool_name),
                    args_schema=config.schema
                )
                tools.append(tool)

                logger.debug(f"[SkillExecutor] Built tool: {tool_name} for skill {skill_name}")

        logger.info(f"[SkillExecutor] Built {len(tools)} tools for {len(skill_names)} skills")
        return tools

    def get_tool_config(self, tool_name: str) -> Optional[ToolConfig]:
        """Get configuration for a tool by name."""
        return TOOL_REGISTRY.get(tool_name)

    def get_all_tools(self) -> List[str]:
        """Get list of all available tool names."""
        return list(TOOL_REGISTRY.keys())


# Global skill executor instance
_skill_executor: Optional[SkillExecutor] = None


def get_skill_executor() -> Optional[SkillExecutor]:
    """Get the global skill executor instance."""
    return _skill_executor


def init_skill_executor(skill_loader: "SkillLoader", node_executor, database=None) -> SkillExecutor:
    """Initialize the global skill executor.

    Args:
        skill_loader: SkillLoader instance
        node_executor: NodeExecutor or function to execute node handlers
        database: Database instance for memory operations

    Returns:
        Initialized SkillExecutor
    """
    global _skill_executor
    _skill_executor = SkillExecutor(skill_loader, node_executor, database)
    return _skill_executor
