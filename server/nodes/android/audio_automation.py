from ._base import AndroidServiceBase


class AudioAutomationNode(AndroidServiceBase):
    type = "audioAutomation"
    display_name = "Audio Automation"
    icon = "lucide:Volume2"
    description = "Volume and audio control - get/set volume, mute, unmute"
