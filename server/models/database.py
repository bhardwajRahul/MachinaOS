"""SQLModel database models and tables."""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field, Column, DateTime, JSON
from sqlalchemy import func


class NodeParameter(SQLModel, table=True):
    """Node parameters storage."""

    __tablename__ = "node_parameters"

    id: Optional[int] = Field(default=None, primary_key=True)
    node_id: str = Field(index=True, unique=True, max_length=255)
    parameters: Dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )


class Workflow(SQLModel, table=True):
    """Workflow definitions."""

    __tablename__ = "workflows"

    id: str = Field(primary_key=True, max_length=255)
    name: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    data: Dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )


class Execution(SQLModel, table=True):
    """Workflow execution history."""

    __tablename__ = "executions"

    id: str = Field(primary_key=True, max_length=255)
    workflow_id: str = Field(foreign_key="workflows.id", max_length=255)
    node_id: str = Field(max_length=255)
    status: str = Field(default="pending", max_length=50)
    result: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    error: Optional[str] = Field(default=None, max_length=2000)
    execution_time: Optional[float] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )


class APIKey(SQLModel, table=True):
    """Encrypted API key storage."""

    __tablename__ = "api_keys"

    id: str = Field(primary_key=True, max_length=255)
    provider: str = Field(max_length=50)
    session_id: str = Field(default="default", max_length=255)
    key_encrypted: str = Field(max_length=1000)
    key_hash: str = Field(max_length=64, index=True)
    models: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    is_valid: bool = Field(default=True)
    last_validated: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )


class APIKeyValidation(SQLModel, table=True):
    """API key validation cache."""

    __tablename__ = "api_key_validations"

    id: Optional[int] = Field(default=None, primary_key=True)
    key_hash: str = Field(unique=True, max_length=64, index=True)
    validated: bool = Field(default=True)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )


class NodeOutput(SQLModel, table=True):
    """Node execution output storage - persisted across server restarts."""

    __tablename__ = "node_outputs"

    id: Optional[int] = Field(default=None, primary_key=True)
    node_id: str = Field(index=True, max_length=255)
    session_id: str = Field(default="default", max_length=255)
    output_name: str = Field(default="output_0", max_length=100)
    data: Dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )


class ConversationMessage(SQLModel, table=True):
    """AI conversation message storage - persisted across server restarts."""

    __tablename__ = "conversation_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True, max_length=255)
    role: str = Field(max_length=20)  # 'human' or 'ai'
    content: str = Field(max_length=50000)  # Large content support
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )


class ToolSchema(SQLModel, table=True):
    """Tool node schema configuration - stores LLM-visible schema for tool nodes.

    This allows Android Toolkit and other aggregator nodes to update the schema
    of connected tool nodes, providing the LLM with accurate capability information.
    """

    __tablename__ = "tool_schemas"

    id: Optional[int] = Field(default=None, primary_key=True)
    node_id: str = Field(index=True, unique=True, max_length=255)
    tool_name: str = Field(max_length=255)  # e.g., 'android_device', 'calculator'
    tool_description: str = Field(max_length=2000)  # Description shown to LLM
    schema_config: Dict[str, Any] = Field(sa_column=Column(JSON))  # Schema fields and types
    connected_services: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))  # For toolkit nodes
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )


class UserSkill(SQLModel, table=True):
    """User-created custom skills for Chat Agent.

    Skills are defined using the Agent Skills specification format with YAML frontmatter.
    This allows non-technical users to create and manage skills via the UI editor.
    """

    __tablename__ = "user_skills"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=100)  # Unique skill identifier
    display_name: str = Field(max_length=200)  # Human-readable name
    description: str = Field(max_length=1000)  # Short description for skill registry
    instructions: str = Field(max_length=50000)  # Full markdown instructions
    allowed_tools: Optional[str] = Field(default=None, max_length=1000)  # Comma-separated tool names
    category: str = Field(default="custom", max_length=50)  # Skill category
    icon: str = Field(default="star", max_length=50)  # Icon identifier
    color: str = Field(default="#6366F1", max_length=20)  # Color hex code
    metadata_json: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))  # Additional metadata
    is_active: bool = Field(default=True)  # Whether skill is available
    created_by: Optional[int] = Field(default=None)  # User ID who created it
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )