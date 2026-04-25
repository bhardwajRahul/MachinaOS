from ._base import AndroidServiceBase


class NetworkMonitorNode(AndroidServiceBase):
    type = "networkMonitor"
    display_name = "Network Monitor"
    icon = "lucide:Antenna"
    description = "Monitor network connectivity, type, and internet availability"
