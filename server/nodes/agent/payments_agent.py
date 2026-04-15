from ._specialized import SpecializedAgentBase


class PaymentsAgentNode(SpecializedAgentBase):
    type = "payments_agent"
    display_name = "Payments Agent"
    subtitle = "Payment Processing"
    icon = "💳"
    color = "#50fa7b"
    group = ("agent",)
    description = "AI agent for payment processing"
