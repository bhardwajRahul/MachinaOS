from ._specialized import SpecializedAgentBase


class TravelAgentNode(SpecializedAgentBase):
    type = "travel_agent"
    display_name = "Travel Agent"
    subtitle = "Travel Planning"
    icon = "lucide:Plane"
    color = "#ffb86c"
    group = ("agent",)
    description = "AI agent for travel planning"
