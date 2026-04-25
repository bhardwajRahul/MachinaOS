from ._base import AndroidServiceBase


class CameraControlNode(AndroidServiceBase):
    type = "cameraControl"
    display_name = "Camera"
    icon = "lucide:Camera"
    description = "Camera control - get info, take photos, capabilities"
