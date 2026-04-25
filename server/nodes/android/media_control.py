from ._base import AndroidServiceBase


class MediaControlNode(AndroidServiceBase):
    type = "mediaControl"
    display_name = "Media Control"
    icon = "lucide:Music"
    description = "Media playback - volume, playback, play files"
