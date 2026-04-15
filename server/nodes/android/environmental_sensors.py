from ._base import AndroidServiceBase


class EnvironmentalSensorsNode(AndroidServiceBase):
    type = "environmentalSensors"
    display_name = "Environmental Sensors"
    icon = "🌡"
    description = "Temperature, humidity, pressure, light level"
