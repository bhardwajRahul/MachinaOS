from ._base import AndroidServiceBase


class BatteryMonitorNode(AndroidServiceBase):
    type = "batteryMonitor"
    display_name = "Battery Monitor"
    icon = "🔋"
    description = "Monitor battery status, level, charging state, temperature, and health"
