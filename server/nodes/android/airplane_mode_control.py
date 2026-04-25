from ._base import AndroidServiceBase


class AirplaneModeControlNode(AndroidServiceBase):
    type = "airplaneModeControl"
    display_name = "Airplane Mode"
    icon = "lucide:Plane"
    description = "Airplane mode status monitoring and control"
