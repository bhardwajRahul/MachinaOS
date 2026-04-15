from ._base import AndroidServiceBase


class CameraControlNode(AndroidServiceBase):
    type = "cameraControl"
    display_name = "Camera"
    icon = "📷"
    description = "Camera control - get info, take photos, capabilities"
