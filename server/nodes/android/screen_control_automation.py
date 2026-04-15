from ._base import AndroidServiceBase


class ScreenControlAutomationNode(AndroidServiceBase):
    type = "screenControlAutomation"
    display_name = "Screen Control"
    icon = "💡"
    description = "Screen control - brightness, wake screen, auto-brightness"
