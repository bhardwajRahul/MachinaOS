from typing import Optional

from pydantic import Field

from ._base import ChatModelBase, ChatModelParams

from credentials.llm import OpenRouterCredential


class OpenRouterChatModelParams(ChatModelParams):
    frequency_penalty: Optional[float] = Field(
        default=0.0, alias="frequencyPenalty", ge=-2.0, le=2.0,
    )
    presence_penalty: Optional[float] = Field(
        default=0.0, alias="presencePenalty", ge=-2.0, le=2.0,
    )


class OpenRouterChatModelNode(ChatModelBase):
    type = "openrouterChatModel"
    display_name = "OpenRouter"
    subtitle = "Chat Model"
    icon = "lobehub:openrouter"
    color = "#6366F1"
    group = ("model",)
    description = "OpenRouter unified API - access OpenAI, Claude, Gemini, Llama, and more"

    credentials = (OpenRouterCredential,)
    Params = OpenRouterChatModelParams
