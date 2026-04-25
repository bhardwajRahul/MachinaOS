from ._base import AndroidServiceBase


class AppListNode(AndroidServiceBase):
    type = "appList"
    display_name = "App List"
    icon = "lucide:ClipboardList"
    description = "Get list of installed applications"
