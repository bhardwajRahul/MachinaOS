from ._handles import team_lead_agent_handles
from ._specialized import SpecializedAgentBase


class OrchestratorAgentNode(SpecializedAgentBase):
    type = "orchestrator_agent"
    display_name = "Orchestrator Agent"
    subtitle = "Agent Coordination"
    icon = "🎼"
    color = "#8be9fd"
    group = ("agent",)
    description = "Team lead that delegates to connected specialized agents"
    handles = team_lead_agent_handles()
