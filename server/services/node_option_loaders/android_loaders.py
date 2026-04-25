"""Android dynamic option loaders.

Returns the list of actions supported by each Android service node.
The frontend passes ``node_type`` in params; the loader maps it to the
service's ``action`` enum advertised by the running Android bridge.
"""

from __future__ import annotations

from typing import Any


async def load_android_service_actions(params: dict[str, Any]) -> list[dict[str, Any]]:
    """Return ``[{value, label}]`` for the given Android service node.

    Kept minimal — each service's `execute_action` endpoint validates
    the action at call time; the dropdown is convenience UX, not a
    correctness boundary. The frontend falls back to a free-text input
    if the loader returns an empty list.
    """
    node_type = params.get("node_type") or ""
    service_id = _ANDROID_SERVICE_MAP.get(node_type)
    if not service_id:
        return []

    try:
        from core.container import container

        android_svc = container.android_service()
        actions = await android_svc.list_actions(service_id)  # type: ignore[attr-defined]
        return [{"value": a, "label": a.replace("_", " ").title()} for a in actions or []]
    except Exception:
        # Service offline / discovery failed — dropdown stays empty, user
        # can still type the action name manually.
        return []


_ANDROID_SERVICE_MAP = {
    "batteryMonitor": "battery",
    "networkMonitor": "network",
    "systemInfo": "system_info",
    "location": "location",
    "appLauncher": "app_launcher",
    "appList": "app_list",
    "wifiAutomation": "wifi_automation",
    "bluetoothAutomation": "bluetooth_automation",
    "audioAutomation": "audio_automation",
    "deviceStateAutomation": "device_state",
    "screenControlAutomation": "screen_control",
    "airplaneModeControl": "airplane_mode",
    "motionDetection": "motion_detection",
    "environmentalSensors": "environmental_sensors",
    "cameraControl": "camera_control",
    "mediaControl": "media_control",
}
