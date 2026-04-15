from typing import Literal, Optional

from pydantic import Field

from ._base import ChatModelBase, ChatModelParams


class GroqChatModelParams(ChatModelParams):
    thinking_enabled: bool = Field(default=False, alias="thinkingEnabled")
    reasoning_format: Optional[Literal["parsed", "hidden"]] = Field(
        default="parsed", alias="reasoningFormat",
        json_schema_extra={"displayOptions": {"show": {"thinking_enabled": [True]}}},
    )


class GroqChatModelNode(ChatModelBase):
    type = "groqChatModel"
    display_name = "Groq"
    subtitle = "Chat Model"
    icon = "lobehub:groq"
    color = "#F55036"
    group = ("model",)
    description = "Groq ultra-fast LLM inference (Llama, Qwen3, GPT-OSS)"

    Params = GroqChatModelParams
