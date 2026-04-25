from ._specialized import SpecializedAgentBase


class ConsumerAgentNode(SpecializedAgentBase):
    type = "consumer_agent"
    display_name = "Consumer Agent"
    subtitle = "Consumer Support"
    icon = "lucide:ShoppingCart"
    color = "#bd93f9"
    group = ("agent",)
    description = "AI agent for consumer interactions"
