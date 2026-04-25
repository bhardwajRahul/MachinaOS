from ._base import AndroidServiceBase


class DeviceStateAutomationNode(AndroidServiceBase):
    type = "deviceStateAutomation"
    display_name = "Device State"
    icon = "lucide:Settings"
    description = "Device state control - airplane mode, screen on/off, brightness"
