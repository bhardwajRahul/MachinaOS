from ._base import AndroidServiceBase


class MotionDetectionNode(AndroidServiceBase):
    type = "motionDetection"
    display_name = "Motion Detection"
    icon = "lucide:Vibrate"
    description = "Accelerometer + gyroscope - motion, shake, orientation"
