from ._base import AndroidServiceBase


class WifiAutomationNode(AndroidServiceBase):
    type = "wifiAutomation"
    display_name = "WiFi Automation"
    icon = "lucide:Signal"
    description = "WiFi control and scanning"
