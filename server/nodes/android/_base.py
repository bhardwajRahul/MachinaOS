"""Shared base for Android service plugins.

16 Android nodes (battery, network, wifi, bluetooth, audio, camera, …)
all dispatch through ``invoke()`` with the node_type as the service ID.
Subclass + set 5 attrs to mint a new one. ``android_service`` is fetched
from the DI container at call time — Android relay client is process
singleton.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

logger = get_logger(__name__)


# Maps camelCase node types to snake_case service IDs.
# Same map is mirrored in services/handlers/tools.py for the AI-tool path.
SERVICE_ID_MAP: Dict[str, str] = {
    'batteryMonitor': 'battery',
    'networkMonitor': 'network',
    'systemInfo': 'system_info',
    'location': 'location',
    'appLauncher': 'app_launcher',
    'appList': 'app_list',
    'wifiAutomation': 'wifi_automation',
    'bluetoothAutomation': 'bluetooth_automation',
    'audioAutomation': 'audio_automation',
    'deviceStateAutomation': 'device_state',
    'screenControlAutomation': 'screen_control',
    'airplaneModeControl': 'airplane_mode',
    'motionDetection': 'motion_detection',
    'environmentalSensors': 'environmental_sensors',
    'cameraControl': 'camera_control',
    'mediaControl': 'media_control',
}


class AndroidServiceParams(BaseModel):
    action: str = Field(default="status", description="Service action to invoke")
    parameters: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class AndroidServiceOutput(BaseModel):
    success: Optional[bool] = None
    data: Optional[Any] = None

    model_config = ConfigDict(extra="allow")


class AndroidServiceBase(ActionNode, abstract=True):
    """Subclass and set type/display_name/icon/description."""

    color = "#50fa7b"
    group = ("android", "service")
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left",
         "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right",
         "label": "Output", "role": "main"},
    )
    annotations = {"destructive": False, "readonly": False, "open_world": True}
    task_queue = TaskQueue.ANDROID
    usable_as_tool = True

    Params = AndroidServiceParams
    Output = AndroidServiceOutput

    @Operation("invoke", cost={"service": "android", "action": "service_call", "count": 1})
    async def invoke(self, ctx: NodeContext, params: AndroidServiceParams) -> Any:
        from core.container import container

        android_service = container.android_service()
        payload = params.model_dump()

        # Derive service_id from the registered node type (battery etc.) —
        # hidden params may not be in the DB so the type is the source of truth.
        service_id = SERVICE_ID_MAP.get(self.type, payload.get('service_id', 'battery'))
        action = payload.get('action', 'status')
        service_params = payload.get('parameters', {})
        android_host = payload.get('android_host', 'localhost')
        android_port = payload.get('android_port', 8888)

        # Parse JSON-string parameters defensively.
        if isinstance(service_params, str):
            try:
                service_params = json.loads(service_params)
            except json.JSONDecodeError:
                service_params = {}

        # Hoist root-level additional properties (e.g. package_name from
        # appLauncher's additionalProperties UI) into service_params.
        for key in ('package_name',):
            if payload.get(key):
                service_params[key] = payload[key]

        logger.debug(
            "[Android] node_type=%s -> service_id=%s action=%s host=%s:%s params=%s",
            self.type, service_id, action, android_host, android_port, service_params,
        )

        result = await android_service.execute_service(
            node_id=ctx.node_id,
            service_id=service_id,
            action=action,
            parameters=service_params,
            android_host=android_host,
            android_port=android_port,
        )
        if isinstance(result, dict) and result.get("success") is False:
            raise RuntimeError(result.get("error") or f"{self.type} failed")
        if isinstance(result, dict):
            return result.get("result") or result
        return result
