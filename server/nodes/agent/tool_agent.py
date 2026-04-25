from ._specialized import SpecializedAgentBase


class ToolAgentNode(SpecializedAgentBase):
    type = "tool_agent"
    display_name = "Tool Agent"
    subtitle = "Tool Orchestration"
    icon = "lucide:Wrench"
    color = "#f1fa8c"
    group = ("agent",)
    description = "AI agent for tool orchestration"
