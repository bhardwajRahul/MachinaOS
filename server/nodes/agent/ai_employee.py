from ._handles import team_lead_agent_handles
from ._specialized import SpecializedAgentBase


class AIEmployeeNode(SpecializedAgentBase):
    type = "ai_employee"
    display_name = "AI Employee"
    subtitle = "Team Orchestration"
    icon = "lucide:Users"
    color = "#bd93f9"
    group = ("agent",)
    description = "Team lead for multi-agent coordination"
    handles = team_lead_agent_handles()
