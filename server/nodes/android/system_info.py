from ._base import AndroidServiceBase


class SystemInfoNode(AndroidServiceBase):
    type = "systemInfo"
    display_name = "System Info"
    icon = "lucide:Smartphone"
    description = "Get device and OS information"
