from ._base import AndroidServiceBase


class EnvironmentalSensorsNode(AndroidServiceBase):
    type = "environmentalSensors"
    display_name = "Environmental Sensors"
    icon = "lucide:Thermometer"
    description = "Temperature, humidity, pressure, light level"
