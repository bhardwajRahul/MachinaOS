from ._base import ChatModelBase


class KimiChatModelNode(ChatModelBase):
    type = "kimiChatModel"
    display_name = "Kimi"
    subtitle = "Chat Model"
    icon = "lobehub:kimi"
    color = "#bd93f9"
    group = ("model",)
    description = "Kimi K2 models by Moonshot AI with 256K context (thinking on by default)"
