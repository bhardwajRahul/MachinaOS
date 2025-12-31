"""Modern async database service with SQLModel and SQLAlchemy 2.0."""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlmodel import SQLModel, select, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.exc import IntegrityError
from contextlib import asynccontextmanager

from core.config import Settings
from models.database import NodeParameter, Workflow, Execution, APIKey, APIKeyValidation, NodeOutput, ConversationMessage
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

            logger.info("Database initialized successfully")

        except Exception as e:
            logger.error("Database startup failed", error=str(e))
            raise

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