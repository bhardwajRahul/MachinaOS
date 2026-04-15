from typing import Literal, Optional

from pydantic import Field

from ._base import ChatModelBase, ChatModelParams


class OpenAIChatModelParams(ChatModelParams):
    frequency_penalty: Optional[float] = Field(
        default=0.0, alias="frequencyPenalty", ge=-2.0, le=2.0,
        json_schema_extra={"numberStepSize": 0.1},
    )
    presence_penalty: Optional[float] = Field(
        default=0.0, alias="presencePenalty", ge=-2.0, le=2.0,
        json_schema_extra={"numberStepSize": 0.1},
    )
    response_format: Optional[Literal["text", "json_object"]] = Field(
        default="text", alias="responseFormat",
    )
    thinking_enabled: bool = Field(default=False, alias="thinkingEnabled")
    reasoning_effort: Optional[Literal["minimal", "low", "medium", "high"]] = Field(
        default="medium", alias="reasoningEffort",
        json_schema_extra={"displayOptions": {"show": {"thinking_enabled": [True]}}},
    )


class OpenAIChatModelNode(ChatModelBase):
    type = "openaiChatModel"
    display_name = "OpenAI"
    subtitle = "Chat Model"
    icon = "lobehub:openai"
    color = "#00A67E"
    group = ("model",)
    description = "OpenAI GPT models for chat completion and generation"

    Params = OpenAIChatModelParams
