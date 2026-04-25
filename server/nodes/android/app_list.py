from ._base import AndroidServiceBase


class AppListNode(AndroidServiceBase):
    type = "appList"
    display_name = "App List"
    icon = "📋"
    description = "Get list of installed applications"
