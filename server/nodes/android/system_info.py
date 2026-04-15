from ._base import AndroidServiceBase


class SystemInfoNode(AndroidServiceBase):
    type = "systemInfo"
    display_name = "System Info"
    icon = "🖥"
    description = "Get device and OS information"
