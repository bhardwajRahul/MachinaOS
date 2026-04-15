from ._base import ChatModelBase

from credentials.llm import MistralCredential


class MistralChatModelNode(ChatModelBase):
    type = "mistralChatModel"
    display_name = "Mistral"
    subtitle = "Chat Model"
    icon = "lobehub:mistral"
    color = "#ffb86c"
    group = ("model",)
    description = "Mistral AI models for reasoning, coding, and multilingual tasks"
    credentials = (MistralCredential,)
