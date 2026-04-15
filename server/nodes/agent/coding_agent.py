from ._specialized import SpecializedAgentBase


class CodingAgentNode(SpecializedAgentBase):
    type = "coding_agent"
    display_name = "Coding Agent"
    subtitle = "Code Execution"
    icon = "💻"
    color = "#8be9fd"
    group = ("agent",)
    description = "AI agent for code execution"
