from ._base import AndroidServiceBase


class LocationNode(AndroidServiceBase):
    type = "location"
    display_name = "Location"
    icon = "lucide:MapPin"
    description = "GPS location tracking with latitude, longitude, accuracy, and provider"
