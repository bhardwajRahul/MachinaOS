"""Modern async database service with SQLModel and SQLAlchemy 2.0."""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlmodel import SQLModel, select, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from contextlib import asynccontextmanager

from core.config import Settings
from models.database import NodeParameter, Workflow, Execution, APIKey, APIKeyValidation, NodeOutput, ConversationMessage, ToolSchema, UserSkill, ChatMessage, UserSettings
from models.cache import CacheEntry  # SQLite-backed cache for Redis alternative
from models.auth import User  # Import User model to ensure table creation
from core.logging import get_logger

logger = get_logger(__name__)


class Database:
    """Async database service with SQLModel."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.engine = None
        self.async_session = None

    async def startup(self):
        """Initialize database connection and create tables."""
        try:
            # Disable verbose database and asyncio logging
            import logging
            logging.getLogger("aiosqlite").setLevel(logging.WARNING)
            logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
            logging.getLogger("sqlalchemy.dialects").setLevel(logging.WARNING)
            logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

            # Create async engine
            self.engine = create_async_engine(
                self.settings.database_url,
                echo=self.settings.database_echo,
                pool_size=self.settings.database_pool_size,
                max_overflow=self.settings.database_max_overflow,
                future=True
            )

            # Create session factory
            self.async_session = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )

            # Create tables
            async with self.engine.begin() as conn:
                await conn.run_sync(SQLModel.metadata.create_all)

            # Add missing columns to existing tables (simple migration)
            await self._migrate_user_settings()

            logger.info("Database initialized successfully")

        except Exception as e:
            logger.error("Database startup failed", error=str(e))
            raise

    async def _migrate_user_settings(self):
        """Add missing columns to user_settings table."""
        try:
            async with self.engine.begin() as conn:
                # Check if column exists and add if missing
                result = await conn.execute(text("PRAGMA table_info(user_settings)"))
                columns = {row[1] for row in result.fetchall()}

                if "console_panel_default_open" not in columns:
                    await conn.execute(text(
                        "ALTER TABLE user_settings ADD COLUMN console_panel_default_open BOOLEAN DEFAULT 0"
                    ))
                    logger.info("Added console_panel_default_open column to user_settings")
        except Exception as e:
            logger.warning(f"Migration check failed (table may not exist yet): {e}")

    async def shutdown(self):
        """Close database connections."""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connections closed")

    @asynccontextmanager
    async def get_session(self):
        """Get async database session."""
        if not self.async_session:
            raise RuntimeError("Database not initialized")

        async with self.async_session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    # ============================================================================
    # Node Parameters
    # ============================================================================

    async def save_node_parameters(self, node_id: str, parameters: Dict[str, Any]) -> bool:
        """Save or update node parameters."""
        try:
            async with self.get_session() as session:
                # Try to get existing parameter
                stmt = select(NodeParameter).where(NodeParameter.node_id == node_id)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.parameters = parameters
                else:
                    existing = NodeParameter(
                        node_id=node_id,
                        parameters=parameters
                    )
                    session.add(existing)

                await session.commit()
                return True

        except Exception as e:
            logger.error("Failed to save node parameters", node_id=node_id, error=str(e))
            return False

    async def get_node_parameters(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get node parameters."""
        try:
            async with self.get_session() as session:
                stmt = select(NodeParameter).where(NodeParameter.node_id == node_id)
                result = await session.execute(stmt)
                parameter = result.scalar_one_or_none()

                return parameter.parameters if parameter else None

        except Exception as e:
            logger.error("Failed to get node parameters", node_id=node_id, error=str(e))
            return None

    async def delete_node_parameters(self, node_id: str) -> bool:
        """Delete node parameters."""
        try:
            async with self.get_session() as session:
                stmt = select(NodeParameter).where(NodeParameter.node_id == node_id)
                result = await session.execute(stmt)
                parameter = result.scalar_one_or_none()

                if parameter:
                    await session.delete(parameter)
                    await session.commit()

                return True

        except Exception as e:
            logger.error("Failed to delete node parameters", node_id=node_id, error=str(e))
            return False

    # ============================================================================
    # Workflows
    # ============================================================================

    async def save_workflow(self, workflow_id: str, name: str, data: Dict[str, Any],
                          description: Optional[str] = None) -> bool:
        """Save or update workflow."""
        try:
            async with self.get_session() as session:
                stmt = select(Workflow).where(Workflow.id == workflow_id)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.name = name
                    existing.description = description
                    existing.data = data
                else:
                    existing = Workflow(
                        id=workflow_id,
                        name=name,
                        description=description,
                        data=data
                    )
                    session.add(existing)

                await session.commit()
                return True

        except Exception as e:
            logger.error("Failed to save workflow", workflow_id=workflow_id, error=str(e))
            return False

    async def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get workflow by ID."""
        try:
            async with self.get_session() as session:
                stmt = select(Workflow).where(Workflow.id == workflow_id)
                result = await session.execute(stmt)
                return result.scalar_one_or_none()

        except Exception as e:
            logger.error("Failed to get workflow", workflow_id=workflow_id, error=str(e))
            return None

    async def get_all_workflows(self) -> List[Workflow]:
        """Get all workflows."""
        try:
            async with self.get_session() as session:
                stmt = select(Workflow).order_by(Workflow.updated_at.desc())
                result = await session.execute(stmt)
                return result.scalars().all()

        except Exception as e:
            logger.error("Failed to get all workflows", error=str(e))
            return []

    async def delete_workflow(self, workflow_id: str) -> bool:
        """Delete workflow."""
        try:
            async with self.get_session() as session:
                stmt = select(Workflow).where(Workflow.id == workflow_id)
                result = await session.execute(stmt)
                workflow = result.scalar_one_or_none()

                if workflow:
                    await session.delete(workflow)
                    await session.commit()

                return True

        except Exception as e:
            logger.error("Failed to delete workflow", workflow_id=workflow_id, error=str(e))
            return False

    # ============================================================================
    # Executions
    # ============================================================================

    async def save_execution(self, execution_id: str, workflow_id: str, node_id: str,
                           status: str, result: Optional[Dict[str, Any]] = None,
                           error: Optional[str] = None, execution_time: Optional[float] = None) -> bool:
        """Save execution result."""
        try:
            async with self.get_session() as session:
                execution = Execution(
                    id=execution_id,
                    workflow_id=workflow_id,
                    node_id=node_id,
                    status=status,
                    result=result,
                    error=error,
                    execution_time=execution_time
                )
                session.add(execution)
                await session.commit()
                return True

        except Exception as e:
            logger.error("Failed to save execution", execution_id=execution_id, error=str(e))
            return False

    async def get_execution(self, execution_id: str) -> Optional[Execution]:
        """Get execution by ID."""
        try:
            async with self.get_session() as session:
                stmt = select(Execution).where(Execution.id == execution_id)
                result = await session.execute(stmt)
                return result.scalar_one_or_none()

        except Exception as e:
            logger.error("Failed to get execution", execution_id=execution_id, error=str(e))
            return None

    # ============================================================================
    # API Keys
    # ============================================================================

    async def save_api_key(self, key_id: str, provider: str, session_id: str,
                         key_encrypted: str, key_hash: str,
                         models: Optional[List[str]] = None) -> bool:
        """Save encrypted API key."""
        logger.info(f"Database save_api_key called with key_id: {key_id}, provider: {provider}")

        try:
            async with self.get_session() as session:
                api_key = APIKey(
                    id=key_id,
                    provider=provider,
                    session_id=session_id,
                    key_encrypted=key_encrypted,
                    key_hash=key_hash,
                    models={"models": models} if models else None,
                    last_validated=datetime.now(timezone.utc)
                )
                session.add(api_key)
                await session.commit()
                logger.info(f"Successfully saved new API key: {key_id}")
                return True

        except IntegrityError as e:
            logger.info(f"API key {key_id} already exists, attempting update. Error: {str(e)}")
            # Key already exists, update it
            try:
                async with self.get_session() as session:
                    stmt = select(APIKey).where(APIKey.id == key_id)
                    result = await session.execute(stmt)
                    existing = result.scalar_one_or_none()

                    if existing:
                        logger.info(f"Found existing API key {key_id}, updating...")
                        existing.key_encrypted = key_encrypted
                        existing.key_hash = key_hash
                        existing.models = {"models": models} if models else None
                        existing.last_validated = datetime.now(timezone.utc)
                        await session.commit()
                        logger.info(f"Successfully updated API key: {key_id}")
                        return True
                    else:
                        logger.error(f"Could not find existing API key {key_id} for update")
                        return False
            except Exception as update_e:
                logger.error(f"Failed to update API key {key_id}", error=str(update_e))
                return False

        except Exception as e:
            logger.error("Failed to save API key", provider=provider, error=str(e))
            import traceback
            logger.error("Full traceback", traceback=traceback.format_exc())
            return False

    async def get_api_key(self, key_id: str) -> Optional[APIKey]:
        """Get API key by ID."""
        try:
            async with self.get_session() as session:
                stmt = select(APIKey).where(APIKey.id == key_id)
                result = await session.execute(stmt)
                return result.scalar_one_or_none()

        except Exception as e:
            logger.error("Failed to get API key", key_id=key_id, error=str(e))
            return None

    async def get_api_key_by_provider(self, provider: str, session_id: str = "default") -> Optional[APIKey]:
        """Get API key by provider and session."""
        try:
            async with self.get_session() as session:
                stmt = select(APIKey).where(
                    APIKey.provider == provider,
                    APIKey.session_id == session_id,
                    APIKey.is_valid == True
                )
                result = await session.execute(stmt)
                return result.scalar_one_or_none()

        except Exception as e:
            logger.error("Failed to get API key by provider", provider=provider, error=str(e))
            return None

    async def delete_api_key(self, provider: str, session_id: str = "default") -> bool:
        """Delete API key."""
        try:
            async with self.get_session() as session:
                stmt = select(APIKey).where(
                    APIKey.provider == provider,
                    APIKey.session_id == session_id
                )
                result = await session.execute(stmt)
                api_key = result.scalar_one_or_none()

                if api_key:
                    await session.delete(api_key)
                    await session.commit()
                    logger.debug("API key deleted", provider=provider, session_id=session_id)

                return True

        except Exception as e:
            logger.error("Failed to delete API key", provider=provider, error=str(e))
            return False

    # ============================================================================
    # API Key Validation Cache
    # ============================================================================

    async def save_api_key_validation(self, key_hash: str) -> bool:
        """Save API key validation status."""
        try:
            async with self.get_session() as session:
                validation = APIKeyValidation(
                    key_hash=key_hash,
                    validated=True
                )
                session.add(validation)
                await session.commit()
                return True

        except IntegrityError:
            # Already exists, update timestamp
            async with self.get_session() as session:
                stmt = select(APIKeyValidation).where(APIKeyValidation.key_hash == key_hash)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.timestamp = datetime.now(timezone.utc)
                    await session.commit()
                    return True
                return False

        except Exception as e:
            logger.error("Failed to save API key validation", key_hash=key_hash, error=str(e))
            return False

    async def is_api_key_validated(self, key_hash: str) -> bool:
        """Check if API key is validated."""
        try:
            async with self.get_session() as session:
                stmt = select(APIKeyValidation).where(APIKeyValidation.key_hash == key_hash)
                result = await session.execute(stmt)
                validation = result.scalar_one_or_none()
                return validation is not None and validation.validated

        except Exception as e:
            logger.error("Failed to check API key validation", key_hash=key_hash, error=str(e))
            return False

    # ============================================================================
    # Node Outputs
    # ============================================================================

    async def save_node_output(self, node_id: str, session_id: str, output_name: str,
                               data: Dict[str, Any]) -> bool:
        """Save or update node output."""
        try:
            async with self.get_session() as session:
                # Try to get existing output
                stmt = select(NodeOutput).where(
                    NodeOutput.node_id == node_id,
                    NodeOutput.session_id == session_id,
                    NodeOutput.output_name == output_name
                )
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                action = "updated"
                if existing:
                    existing.data = data
                else:
                    action = "inserted"
                    existing = NodeOutput(
                        node_id=node_id,
                        session_id=session_id,
                        output_name=output_name,
                        data=data
                    )
                    session.add(existing)

                await session.commit()
                logger.info("[DB] Node output saved", action=action, node_id=node_id, session_id=session_id, output_name=output_name)
                return True

        except Exception as e:
            logger.error("Failed to save node output", node_id=node_id, error=str(e))
            import traceback
            traceback.print_exc()
            return False

    async def get_node_output(self, node_id: str, session_id: str = "default",
                              output_name: str = "output_0") -> Optional[Dict[str, Any]]:
        """Get node output data."""
        try:
            async with self.get_session() as session:
                stmt = select(NodeOutput).where(
                    NodeOutput.node_id == node_id,
                    NodeOutput.session_id == session_id,
                    NodeOutput.output_name == output_name
                )
                result = await session.execute(stmt)
                output = result.scalar_one_or_none()

                return output.data if output else None

        except Exception as e:
            logger.error("Failed to get node output", node_id=node_id, error=str(e))
            return None

    async def delete_node_output(self, node_id: str) -> int:
        """Delete all outputs for a node (any session). Returns count deleted."""
        try:
            async with self.get_session() as session:
                stmt = select(NodeOutput).where(NodeOutput.node_id == node_id)
                result = await session.execute(stmt)
                outputs = result.scalars().all()

                count = len(outputs)
                for output in outputs:
                    await session.delete(output)

                await session.commit()
                logger.info("Deleted node outputs", node_id=node_id, count=count)
                return count

        except Exception as e:
            logger.error("Failed to delete node output", node_id=node_id, error=str(e))
            return 0

    async def clear_session_outputs(self, session_id: str = "default") -> int:
        """Clear all outputs for a session. Returns count deleted."""
        try:
            async with self.get_session() as session:
                stmt = select(NodeOutput).where(NodeOutput.session_id == session_id)
                result = await session.execute(stmt)
                outputs = result.scalars().all()

                count = len(outputs)
                for output in outputs:
                    await session.delete(output)

                await session.commit()
                logger.info("Cleared session outputs", session_id=session_id, count=count)
                return count

        except Exception as e:
            logger.error("Failed to clear session outputs", session_id=session_id, error=str(e))
            return 0

    # ============================================================================
    # Conversation Messages (AI Memory)
    # ============================================================================

    async def add_conversation_message(self, session_id: str, role: str, content: str) -> bool:
        """Add a message to conversation history."""
        try:
            async with self.get_session() as session:
                message = ConversationMessage(
                    session_id=session_id,
                    role=role,
                    content=content
                )
                session.add(message)
                await session.commit()
                logger.info(f"[Memory] Added {role} message to session '{session_id}'")
                return True

        except Exception as e:
            logger.error("Failed to add conversation message", session_id=session_id, error=str(e))
            return False

    async def get_conversation_messages(self, session_id: str, window_size: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get conversation messages, optionally limited to last N."""
        try:
            async with self.get_session() as session:
                stmt = select(ConversationMessage).where(
                    ConversationMessage.session_id == session_id
                ).order_by(ConversationMessage.created_at.asc())

                result = await session.execute(stmt)
                messages = result.scalars().all()

                # Apply window limit if specified
                if window_size and window_size > 0:
                    messages = messages[-window_size:]

                return [
                    {
                        "role": m.role,
                        "content": m.content,
                        "timestamp": m.created_at.isoformat()
                    }
                    for m in messages
                ]

        except Exception as e:
            logger.error("Failed to get conversation messages", session_id=session_id, error=str(e))
            return []

    async def clear_conversation(self, session_id: str) -> int:
        """Clear all messages in a conversation session. Returns count deleted."""
        try:
            async with self.get_session() as session:
                stmt = select(ConversationMessage).where(
                    ConversationMessage.session_id == session_id
                )
                result = await session.execute(stmt)
                messages = result.scalars().all()

                count = len(messages)
                for message in messages:
                    await session.delete(message)

                await session.commit()
                logger.info(f"[Memory] Cleared {count} messages from session '{session_id}'")
                return count

        except Exception as e:
            logger.error("Failed to clear conversation", session_id=session_id, error=str(e))
            return 0

    async def get_all_conversation_sessions(self) -> List[Dict[str, Any]]:
        """Get info about all conversation sessions."""
        try:
            async with self.get_session() as session:
                # Get distinct session IDs with message count
                from sqlalchemy import func as sql_func
                stmt = select(
                    ConversationMessage.session_id,
                    sql_func.count(ConversationMessage.id).label('message_count'),
                    sql_func.min(ConversationMessage.created_at).label('created_at')
                ).group_by(ConversationMessage.session_id)

                result = await session.execute(stmt)
                rows = result.all()

                return [
                    {
                        "session_id": row.session_id,
                        "message_count": row.message_count,
                        "created_at": row.created_at.isoformat() if row.created_at else None
                    }
                    for row in rows
                ]

        except Exception as e:
            logger.error("Failed to get conversation sessions", error=str(e))
            return []

    # ============================================================================
    # Chat Messages (Console Panel persistence)
    # ============================================================================

    async def add_chat_message(self, session_id: str, role: str, message: str) -> bool:
        """Add a chat message to the console panel history."""
        try:
            async with self.get_session() as session:
                chat_msg = ChatMessage(
                    session_id=session_id,
                    role=role,
                    message=message
                )
                session.add(chat_msg)
                await session.commit()
                logger.debug(f"[Chat] Added {role} message to session '{session_id}'")
                return True

        except Exception as e:
            logger.error("Failed to add chat message", session_id=session_id, error=str(e))
            return False

    async def get_chat_messages(self, session_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get chat messages for a session, optionally limited to last N."""
        try:
            async with self.get_session() as session:
                stmt = select(ChatMessage).where(
                    ChatMessage.session_id == session_id
                ).order_by(ChatMessage.created_at.asc())

                result = await session.execute(stmt)
                messages = result.scalars().all()

                # Apply limit if specified
                if limit and limit > 0:
                    messages = messages[-limit:]

                return [
                    {
                        "role": m.role,
                        "message": m.message,
                        "timestamp": m.created_at.isoformat()
                    }
                    for m in messages
                ]

        except Exception as e:
            logger.error("Failed to get chat messages", session_id=session_id, error=str(e))
            return []

    async def clear_chat_messages(self, session_id: str) -> int:
        """Clear all chat messages for a session. Returns count deleted."""
        try:
            async with self.get_session() as session:
                stmt = select(ChatMessage).where(
                    ChatMessage.session_id == session_id
                )
                result = await session.execute(stmt)
                messages = result.scalars().all()

                count = len(messages)
                for message in messages:
                    await session.delete(message)

                await session.commit()
                logger.info(f"[Chat] Cleared {count} messages from session '{session_id}'")
                return count

        except Exception as e:
            logger.error("Failed to clear chat messages", session_id=session_id, error=str(e))
            return 0

    async def get_chat_sessions(self) -> List[Dict[str, Any]]:
        """Get list of all chat sessions with message counts."""
        try:
            async with self.get_session() as session:
                from sqlalchemy import func as sa_func
                stmt = select(
                    ChatMessage.session_id,
                    sa_func.count(ChatMessage.id).label('message_count'),
                    sa_func.max(ChatMessage.created_at).label('last_message_at')
                ).group_by(ChatMessage.session_id).order_by(sa_func.max(ChatMessage.created_at).desc())

                result = await session.execute(stmt)
                rows = result.all()

                return [
                    {
                        "session_id": row.session_id,
                        "message_count": row.message_count,
                        "last_message_at": row.last_message_at.isoformat() if row.last_message_at else None
                    }
                    for row in rows
                ]

        except Exception as e:
            logger.error("Failed to get chat sessions", error=str(e))
            return []

    # ============================================================================
    # Console Logs (Console Panel persistence)
    # ============================================================================

    async def add_console_log(self, log_data: Dict[str, Any]) -> bool:
        """Add a console log entry to the database."""
        from models.database import ConsoleLog
        import json

        try:
            async with self.get_session() as session:
                console_log = ConsoleLog(
                    node_id=log_data.get("node_id", ""),
                    label=log_data.get("label", ""),
                    workflow_id=log_data.get("workflow_id"),
                    data=json.dumps(log_data.get("data", {})),
                    formatted=log_data.get("formatted", ""),
                    format=log_data.get("format", "text"),
                    source_node_id=log_data.get("source_node_id"),
                    source_node_type=log_data.get("source_node_type"),
                    source_node_label=log_data.get("source_node_label"),
                )
                session.add(console_log)
                await session.commit()
                logger.debug(f"[Console] Added log from node '{log_data.get('node_id')}'")
                return True

        except Exception as e:
            logger.error("Failed to add console log", error=str(e))
            return False

    async def get_console_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get console logs, optionally limited to last N entries."""
        from models.database import ConsoleLog
        import json

        try:
            async with self.get_session() as session:
                stmt = select(ConsoleLog).order_by(ConsoleLog.created_at.desc()).limit(limit)

                result = await session.execute(stmt)
                logs = result.scalars().all()

                # Return in chronological order (oldest first)
                return [
                    {
                        "node_id": log.node_id,
                        "label": log.label,
                        "workflow_id": log.workflow_id,
                        "data": json.loads(log.data) if log.data else {},
                        "formatted": log.formatted,
                        "format": log.format,
                        "source_node_id": log.source_node_id,
                        "source_node_type": log.source_node_type,
                        "source_node_label": log.source_node_label,
                        "timestamp": log.created_at.isoformat(),
                    }
                    for log in reversed(logs)
                ]

        except Exception as e:
            logger.error("Failed to get console logs", error=str(e))
            return []

    async def clear_console_logs(self) -> int:
        """Clear all console logs. Returns count deleted."""
        from models.database import ConsoleLog

        try:
            async with self.get_session() as session:
                stmt = select(ConsoleLog)
                result = await session.execute(stmt)
                logs = result.scalars().all()

                count = len(logs)
                for log in logs:
                    await session.delete(log)

                await session.commit()
                logger.info(f"[Console] Cleared {count} console logs")
                return count

        except Exception as e:
            logger.error("Failed to clear console logs", error=str(e))
            return 0

    # ============================================================================
    # Cache Entries (SQLite-backed Redis alternative)
    # ============================================================================

    async def get_cache_entry(self, key: str) -> Optional[str]:
        """Get cache value by key. Returns None if expired or not found."""
        import time
        try:
            async with self.get_session() as session:
                stmt = select(CacheEntry).where(CacheEntry.key == key)
                result = await session.execute(stmt)
                entry = result.scalar_one_or_none()

                if not entry:
                    return None

                # Check expiration
                if entry.expires_at and entry.expires_at < time.time():
                    # Entry expired - delete it
                    await session.delete(entry)
                    await session.commit()
                    return None

                return entry.value

        except Exception as e:
            logger.error("Failed to get cache entry", key=key, error=str(e))
            return None

    async def set_cache_entry(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        """Set cache value with optional TTL in seconds."""
        import time
        try:
            expires_at = time.time() + ttl if ttl else None

            async with self.get_session() as session:
                # Try to get existing entry
                stmt = select(CacheEntry).where(CacheEntry.key == key)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.value = value
                    existing.expires_at = expires_at
                    existing.created_at = time.time()
                else:
                    entry = CacheEntry(
                        key=key,
                        value=value,
                        expires_at=expires_at,
                        created_at=time.time()
                    )
                    session.add(entry)

                await session.commit()
                return True

        except Exception as e:
            logger.error("Failed to set cache entry", key=key, error=str(e))
            return False

    async def delete_cache_entry(self, key: str) -> bool:
        """Delete cache entry by key."""
        try:
            async with self.get_session() as session:
                stmt = select(CacheEntry).where(CacheEntry.key == key)
                result = await session.execute(stmt)
                entry = result.scalar_one_or_none()

                if entry:
                    await session.delete(entry)
                    await session.commit()

                return True

        except Exception as e:
            logger.error("Failed to delete cache entry", key=key, error=str(e))
            return False

    async def delete_cache_pattern(self, pattern: str) -> int:
        """Delete cache entries matching pattern (uses SQL LIKE)."""
        try:
            # Convert glob pattern to SQL LIKE pattern
            sql_pattern = pattern.replace("*", "%")

            async with self.get_session() as session:
                stmt = select(CacheEntry).where(CacheEntry.key.like(sql_pattern))
                result = await session.execute(stmt)
                entries = result.scalars().all()

                count = len(entries)
                for entry in entries:
                    await session.delete(entry)

                await session.commit()
                logger.debug("Deleted cache entries", pattern=pattern, count=count)
                return count

        except Exception as e:
            logger.error("Failed to delete cache pattern", pattern=pattern, error=str(e))
            return 0

    async def cleanup_expired_cache(self) -> int:
        """Remove all expired cache entries. Returns count deleted."""
        import time
        try:
            async with self.get_session() as session:
                stmt = select(CacheEntry).where(
                    CacheEntry.expires_at.isnot(None),
                    CacheEntry.expires_at < time.time()
                )
                result = await session.execute(stmt)
                entries = result.scalars().all()

                count = len(entries)
                for entry in entries:
                    await session.delete(entry)

                await session.commit()
                if count > 0:
                    logger.info("Cleaned up expired cache entries", count=count)
                return count

        except Exception as e:
            logger.error("Failed to cleanup expired cache", error=str(e))
            return 0

    async def cache_exists(self, key: str) -> bool:
        """Check if cache key exists and is not expired."""
        import time
        try:
            async with self.get_session() as session:
                stmt = select(CacheEntry).where(CacheEntry.key == key)
                result = await session.execute(stmt)
                entry = result.scalar_one_or_none()

                if not entry:
                    return False

                # Check expiration
                if entry.expires_at and entry.expires_at < time.time():
                    return False

                return True

        except Exception as e:
            logger.error("Failed to check cache exists", key=key, error=str(e))
            return False

    # ============================================================================
    # Tool Schemas (Source of truth for tool node configurations)
    # ============================================================================

    async def save_tool_schema(self, node_id: str, tool_name: str, tool_description: str,
                               schema_config: Dict[str, Any],
                               connected_services: Optional[Dict[str, Any]] = None) -> bool:
        """Save or update tool schema for a node."""
        try:
            async with self.get_session() as session:
                # Try to get existing schema
                stmt = select(ToolSchema).where(ToolSchema.node_id == node_id)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                action = "updated"
                if existing:
                    existing.tool_name = tool_name
                    existing.tool_description = tool_description
                    existing.schema_config = schema_config
                    existing.connected_services = connected_services
                else:
                    action = "created"
                    existing = ToolSchema(
                        node_id=node_id,
                        tool_name=tool_name,
                        tool_description=tool_description,
                        schema_config=schema_config,
                        connected_services=connected_services
                    )
                    session.add(existing)

                await session.commit()
                logger.info(f"[DB] Tool schema {action}", node_id=node_id, tool_name=tool_name)
                return True

        except Exception as e:
            logger.error("Failed to save tool schema", node_id=node_id, error=str(e))
            return False

    async def get_tool_schema(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get tool schema for a node."""
        try:
            async with self.get_session() as session:
                stmt = select(ToolSchema).where(ToolSchema.node_id == node_id)
                result = await session.execute(stmt)
                schema = result.scalar_one_or_none()

                if not schema:
                    return None

                return {
                    "node_id": schema.node_id,
                    "tool_name": schema.tool_name,
                    "tool_description": schema.tool_description,
                    "schema_config": schema.schema_config,
                    "connected_services": schema.connected_services,
                    "created_at": schema.created_at.isoformat() if schema.created_at else None,
                    "updated_at": schema.updated_at.isoformat() if schema.updated_at else None
                }

        except Exception as e:
            logger.error("Failed to get tool schema", node_id=node_id, error=str(e))
            return None

    async def delete_tool_schema(self, node_id: str) -> bool:
        """Delete tool schema for a node."""
        try:
            async with self.get_session() as session:
                stmt = select(ToolSchema).where(ToolSchema.node_id == node_id)
                result = await session.execute(stmt)
                schema = result.scalar_one_or_none()

                if schema:
                    await session.delete(schema)
                    await session.commit()
                    logger.info("[DB] Tool schema deleted", node_id=node_id)

                return True

        except Exception as e:
            logger.error("Failed to delete tool schema", node_id=node_id, error=str(e))
            return False

    async def get_all_tool_schemas(self) -> List[Dict[str, Any]]:
        """Get all tool schemas."""
        try:
            async with self.get_session() as session:
                stmt = select(ToolSchema).order_by(ToolSchema.updated_at.desc())
                result = await session.execute(stmt)
                schemas = result.scalars().all()

                return [
                    {
                        "node_id": s.node_id,
                        "tool_name": s.tool_name,
                        "tool_description": s.tool_description,
                        "schema_config": s.schema_config,
                        "connected_services": s.connected_services,
                        "updated_at": s.updated_at.isoformat() if s.updated_at else None
                    }
                    for s in schemas
                ]

        except Exception as e:
            logger.error("Failed to get all tool schemas", error=str(e))
            return []

    # ============================================================================
    # Android Relay Session Persistence
    # ============================================================================

    async def save_android_relay_session(
        self,
        relay_url: str,
        api_key: str,
        device_id: str,
        device_name: Optional[str] = None,
        session_token: Optional[str] = None
    ) -> bool:
        """Save Android relay pairing session for auto-reconnect on server restart.

        Args:
            relay_url: WebSocket relay URL
            api_key: API key for relay authentication
            device_id: Paired Android device ID
            device_name: Paired device name
            session_token: Relay session token
        """
        import json
        try:
            session_data = json.dumps({
                "relay_url": relay_url,
                "api_key": api_key,
                "device_id": device_id,
                "device_name": device_name,
                "session_token": session_token
            })
            # No TTL - session persists until explicitly cleared
            return await self.set_cache_entry("android_relay_session", session_data)
        except Exception as e:
            logger.error("Failed to save Android relay session", error=str(e))
            return False

    async def get_android_relay_session(self) -> Optional[Dict[str, Any]]:
        """Get stored Android relay session for auto-reconnect.

        Returns:
            Session data dict or None if not found
        """
        import json
        try:
            value = await self.get_cache_entry("android_relay_session")
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error("Failed to get Android relay session", error=str(e))
            return None

    async def clear_android_relay_session(self) -> bool:
        """Clear stored Android relay session (on explicit disconnect)."""
        try:
            return await self.delete_cache_entry("android_relay_session")
        except Exception as e:
            logger.error("Failed to clear Android relay session", error=str(e))
            return False

    # ============================================================================
    # User Skills (Custom skills for Zeenie)
    # ============================================================================

    async def create_user_skill(
        self,
        name: str,
        display_name: str,
        description: str,
        instructions: str,
        allowed_tools: Optional[str] = None,
        category: str = "custom",
        icon: str = "star",
        color: str = "#6366F1",
        metadata_json: Optional[Dict[str, Any]] = None,
        created_by: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Create a new user skill."""
        try:
            async with self.get_session() as session:
                skill = UserSkill(
                    name=name,
                    display_name=display_name,
                    description=description,
                    instructions=instructions,
                    allowed_tools=allowed_tools,
                    category=category,
                    icon=icon,
                    color=color,
                    metadata_json=metadata_json,
                    created_by=created_by
                )
                session.add(skill)
                await session.commit()
                await session.refresh(skill)

                logger.info(f"[DB] Created user skill: {name}")
                return self._skill_to_dict(skill)

        except IntegrityError:
            logger.error(f"User skill with name '{name}' already exists")
            return None
        except Exception as e:
            logger.error("Failed to create user skill", name=name, error=str(e))
            return None

    async def get_user_skill(self, name: str) -> Optional[Dict[str, Any]]:
        """Get user skill by name."""
        try:
            async with self.get_session() as session:
                stmt = select(UserSkill).where(UserSkill.name == name)
                result = await session.execute(stmt)
                skill = result.scalar_one_or_none()

                return self._skill_to_dict(skill) if skill else None

        except Exception as e:
            logger.error("Failed to get user skill", name=name, error=str(e))
            return None

    async def get_user_skill_by_id(self, skill_id: int) -> Optional[Dict[str, Any]]:
        """Get user skill by ID."""
        try:
            async with self.get_session() as session:
                stmt = select(UserSkill).where(UserSkill.id == skill_id)
                result = await session.execute(stmt)
                skill = result.scalar_one_or_none()

                return self._skill_to_dict(skill) if skill else None

        except Exception as e:
            logger.error("Failed to get user skill by id", skill_id=skill_id, error=str(e))
            return None

    async def get_all_user_skills(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all user skills, optionally filtered by active status."""
        try:
            async with self.get_session() as session:
                if active_only:
                    stmt = select(UserSkill).where(UserSkill.is_active == True).order_by(UserSkill.display_name)
                else:
                    stmt = select(UserSkill).order_by(UserSkill.display_name)

                result = await session.execute(stmt)
                skills = result.scalars().all()

                return [self._skill_to_dict(s) for s in skills]

        except Exception as e:
            logger.error("Failed to get all user skills", error=str(e))
            return []

    async def update_user_skill(
        self,
        name: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        instructions: Optional[str] = None,
        allowed_tools: Optional[str] = None,
        category: Optional[str] = None,
        icon: Optional[str] = None,
        color: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
        is_active: Optional[bool] = None
    ) -> Optional[Dict[str, Any]]:
        """Update an existing user skill."""
        try:
            async with self.get_session() as session:
                stmt = select(UserSkill).where(UserSkill.name == name)
                result = await session.execute(stmt)
                skill = result.scalar_one_or_none()

                if not skill:
                    logger.error(f"User skill '{name}' not found for update")
                    return None

                # Update only provided fields
                if display_name is not None:
                    skill.display_name = display_name
                if description is not None:
                    skill.description = description
                if instructions is not None:
                    skill.instructions = instructions
                if allowed_tools is not None:
                    skill.allowed_tools = allowed_tools
                if category is not None:
                    skill.category = category
                if icon is not None:
                    skill.icon = icon
                if color is not None:
                    skill.color = color
                if metadata_json is not None:
                    skill.metadata_json = metadata_json
                if is_active is not None:
                    skill.is_active = is_active

                await session.commit()
                await session.refresh(skill)

                logger.info(f"[DB] Updated user skill: {name}")
                return self._skill_to_dict(skill)

        except Exception as e:
            logger.error("Failed to update user skill", name=name, error=str(e))
            return None

    async def delete_user_skill(self, name: str) -> bool:
        """Delete a user skill by name."""
        try:
            async with self.get_session() as session:
                stmt = select(UserSkill).where(UserSkill.name == name)
                result = await session.execute(stmt)
                skill = result.scalar_one_or_none()

                if skill:
                    await session.delete(skill)
                    await session.commit()
                    logger.info(f"[DB] Deleted user skill: {name}")
                    return True

                return False

        except Exception as e:
            logger.error("Failed to delete user skill", name=name, error=str(e))
            return False

    def _skill_to_dict(self, skill: UserSkill) -> Dict[str, Any]:
        """Convert UserSkill model to dictionary."""
        return {
            "id": skill.id,
            "name": skill.name,
            "display_name": skill.display_name,
            "description": skill.description,
            "instructions": skill.instructions,
            "allowed_tools": skill.allowed_tools.split(",") if skill.allowed_tools else [],
            "category": skill.category,
            "icon": skill.icon,
            "color": skill.color,
            "metadata": skill.metadata_json,
            "is_active": skill.is_active,
            "created_by": skill.created_by,
            "created_at": skill.created_at.isoformat() if skill.created_at else None,
            "updated_at": skill.updated_at.isoformat() if skill.updated_at else None
        }

    # ============================================================================
    # User Settings (UI defaults and preferences)
    # ============================================================================

    async def get_user_settings(self, user_id: str = "default") -> Optional[Dict[str, Any]]:
        """Get user settings. Returns None if not found."""
        try:
            async with self.get_session() as session:
                stmt = select(UserSettings).where(UserSettings.user_id == user_id)
                result = await session.execute(stmt)
                settings = result.scalar_one_or_none()

                if not settings:
                    return None

                return {
                    "user_id": settings.user_id,
                    "auto_save": settings.auto_save,
                    "auto_save_interval": settings.auto_save_interval,
                    "sidebar_default_open": settings.sidebar_default_open,
                    "component_palette_default_open": settings.component_palette_default_open,
                    "console_panel_default_open": settings.console_panel_default_open,
                    "created_at": settings.created_at.isoformat() if settings.created_at else None,
                    "updated_at": settings.updated_at.isoformat() if settings.updated_at else None
                }

        except Exception as e:
            logger.error("Failed to get user settings", user_id=user_id, error=str(e))
            return None

    async def save_user_settings(self, settings_data: Dict[str, Any], user_id: str = "default") -> bool:
        """Save or update user settings."""
        try:
            async with self.get_session() as session:
                # Try to get existing settings
                stmt = select(UserSettings).where(UserSettings.user_id == user_id)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    # Update existing settings
                    if "auto_save" in settings_data:
                        existing.auto_save = settings_data["auto_save"]
                    if "auto_save_interval" in settings_data:
                        existing.auto_save_interval = settings_data["auto_save_interval"]
                    if "sidebar_default_open" in settings_data:
                        existing.sidebar_default_open = settings_data["sidebar_default_open"]
                    if "component_palette_default_open" in settings_data:
                        existing.component_palette_default_open = settings_data["component_palette_default_open"]
                    if "console_panel_default_open" in settings_data:
                        existing.console_panel_default_open = settings_data["console_panel_default_open"]
                else:
                    # Create new settings
                    existing = UserSettings(
                        user_id=user_id,
                        auto_save=settings_data.get("auto_save", True),
                        auto_save_interval=settings_data.get("auto_save_interval", 30),
                        sidebar_default_open=settings_data.get("sidebar_default_open", True),
                        component_palette_default_open=settings_data.get("component_palette_default_open", True),
                        console_panel_default_open=settings_data.get("console_panel_default_open", False)
                    )
                    session.add(existing)

                await session.commit()
                logger.info(f"[DB] User settings saved for user_id: {user_id}")
                return True

        except Exception as e:
            logger.error("Failed to save user settings", user_id=user_id, error=str(e))
            return False