from ._specialized import SpecializedAgentBase


class AutonomousAgentNode(SpecializedAgentBase):
    type = "autonomous_agent"
    display_name = "Autonomous Agent"
    subtitle = "Autonomous Ops"
    icon = "lucide:Target"
    color = "#bd93f9"
    group = ("agent",)
    description = "Autonomous agent using Code Mode patterns"
