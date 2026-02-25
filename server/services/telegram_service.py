"""
Telegram Bot Integration Service

Uses python-telegram-bot v22.6 for Bot API communication.
Singleton service with background polling for receiving updates.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from telegram import Bot, Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

logger = logging.getLogger(__name__)


class TelegramService:
    """Singleton service for Telegram bot operations."""

    _instance: Optional["TelegramService"] = None
    _lock = asyncio.Lock()

    def __init__(self):
        self._application: Optional[Application] = None
        self._bot: Optional[Bot] = None
        self._token: Optional[str] = None
        self._connected: bool = False
        self._polling_task: Optional[asyncio.Task] = None
        self._bot_info: Dict[str, Any] = {}

    @classmethod
    def get_instance(cls) -> "TelegramService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    async def reset_instance(cls):
        """Reset singleton (for testing)."""
        if cls._instance:
            await cls._instance.disconnect()
            cls._instance = None

    @property
    def connected(self) -> bool:
        """Check if bot is connected and polling."""
        return self._connected and self._application is not None

    def get_status(self) -> Dict[str, Any]:
        """Get current connection status."""
        return {
            "connected": self._connected,
            "bot_id": self._bot_info.get("id"),
            "bot_username": self._bot_info.get("username"),
            "bot_name": self._bot_info.get("first_name"),
            "polling_active": self._polling_task is not None and not self._polling_task.done(),
        }

    async def connect(self, token: str) -> Dict[str, Any]:
        """Connect to Telegram with bot token and start polling.

        Args:
            token: Bot token from @BotFather

        Returns:
            Connection result with bot info
        """
        async with self._lock:
            if self._connected:
                await self._disconnect_internal()

            try:
                logger.info("[Telegram] Connecting with bot token...")

                # Create bot and validate token
                bot = Bot(token=token)
                me = await bot.get_me()

                self._bot_info = {
                    "id": me.id,
                    "username": me.username,
                    "first_name": me.first_name,
                    "can_join_groups": me.can_join_groups,
                    "can_read_all_group_messages": me.can_read_all_group_messages,
                }

                logger.info(f"[Telegram] Bot validated: @{me.username} (ID: {me.id})")

                # Build application
                self._application = Application.builder().token(token).build()
                self._bot = self._application.bot
                self._token = token

                # Register message handler for all messages
                self._application.add_handler(
                    MessageHandler(filters.ALL, self._on_message_received)
                )

                # Initialize application
                await self._application.initialize()

                # Start polling in background task
                self._polling_task = asyncio.create_task(self._run_polling())
                self._connected = True

                # Broadcast status update
                await self._broadcast_status()

                logger.info(f"[Telegram] Connected and polling started for @{me.username}")

                return {
                    "success": True,
                    "bot": self._bot_info,
                    "message": f"Connected to @{me.username}",
                }

            except Exception as e:
                logger.error(f"[Telegram] Connection failed: {e}")
                self._connected = False
                self._application = None
                self._bot = None
                return {
                    "success": False,
                    "error": str(e),
                }

    async def disconnect(self) -> Dict[str, Any]:
        """Disconnect bot and stop polling."""
        async with self._lock:
            return await self._disconnect_internal()

    async def _disconnect_internal(self) -> Dict[str, Any]:
        """Internal disconnect (must be called with lock held)."""
        try:
            logger.info("[Telegram] Disconnecting...")

            # Cancel polling task
            if self._polling_task and not self._polling_task.done():
                self._polling_task.cancel()
                try:
                    await self._polling_task
                except asyncio.CancelledError:
                    pass

            # Stop and shutdown application
            if self._application:
                try:
                    await self._application.stop()
                    await self._application.shutdown()
                except Exception as e:
                    logger.warning(f"[Telegram] Shutdown warning: {e}")

            self._application = None
            self._bot = None
            self._token = None
            self._connected = False
            self._polling_task = None

            # Broadcast disconnected status
            await self._broadcast_status()

            logger.info("[Telegram] Disconnected")
            return {"success": True, "message": "Disconnected"}

        except Exception as e:
            logger.error(f"[Telegram] Disconnect error: {e}")
            return {"success": False, "error": str(e)}

    async def _run_polling(self):
        """Run polling loop in background."""
        try:
            logger.info("[Telegram] Starting polling loop...")
            await self._application.start()
            await self._application.updater.start_polling(
                drop_pending_updates=True,
                allowed_updates=Update.ALL_TYPES,
            )

            # Keep running until cancelled
            while True:
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.info("[Telegram] Polling cancelled")
            raise
        except Exception as e:
            logger.error(f"[Telegram] Polling error: {e}")
            self._connected = False
            await self._broadcast_status()

    async def _on_message_received(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle incoming messages and dispatch to event_waiter."""
        try:
            if not update.message:
                return

            msg = update.message
            event_data = self._format_message(msg)

            logger.debug(f"[Telegram] Message received: {event_data.get('content_type')} from {event_data.get('from_username', event_data.get('from_id'))}")

            # Dispatch to event_waiter for trigger nodes
            from services import event_waiter
            event_waiter.dispatch("telegram_message_received", event_data)

        except Exception as e:
            logger.error(f"[Telegram] Message handler error: {e}")

    def _format_message(self, msg) -> Dict[str, Any]:
        """Format Telegram message to unified event data."""
        # Determine content type
        content_type = "text"
        if msg.photo:
            content_type = "photo"
        elif msg.video:
            content_type = "video"
        elif msg.audio:
            content_type = "audio"
        elif msg.voice:
            content_type = "voice"
        elif msg.document:
            content_type = "document"
        elif msg.sticker:
            content_type = "sticker"
        elif msg.location:
            content_type = "location"
        elif msg.contact:
            content_type = "contact"
        elif msg.poll:
            content_type = "poll"

        # Build event data
        data = {
            "message_id": msg.message_id,
            "chat_id": msg.chat.id,
            "chat_type": msg.chat.type,  # private, group, supergroup, channel
            "chat_title": msg.chat.title,
            "from_id": msg.from_user.id if msg.from_user else None,
            "from_username": msg.from_user.username if msg.from_user else None,
            "from_first_name": msg.from_user.first_name if msg.from_user else None,
            "from_last_name": msg.from_user.last_name if msg.from_user else None,
            "is_bot": msg.from_user.is_bot if msg.from_user else False,
            "text": msg.text or msg.caption or "",
            "content_type": content_type,
            "date": msg.date.isoformat() if msg.date else datetime.now().isoformat(),
            "reply_to_message_id": msg.reply_to_message.message_id if msg.reply_to_message else None,
        }

        # Add media info if present
        if msg.photo:
            # Get largest photo
            photo = msg.photo[-1]
            data["photo"] = {
                "file_id": photo.file_id,
                "file_unique_id": photo.file_unique_id,
                "width": photo.width,
                "height": photo.height,
                "file_size": photo.file_size,
            }
        elif msg.document:
            data["document"] = {
                "file_id": msg.document.file_id,
                "file_name": msg.document.file_name,
                "mime_type": msg.document.mime_type,
                "file_size": msg.document.file_size,
            }
        elif msg.location:
            data["location"] = {
                "latitude": msg.location.latitude,
                "longitude": msg.location.longitude,
            }
        elif msg.contact:
            data["contact"] = {
                "phone_number": msg.contact.phone_number,
                "first_name": msg.contact.first_name,
                "last_name": msg.contact.last_name,
                "user_id": msg.contact.user_id,
            }

        return data

    async def _broadcast_status(self):
        """Broadcast connection status to all WebSocket clients."""
        try:
            from services.status_broadcaster import get_status_broadcaster
            broadcaster = get_status_broadcaster()
            await broadcaster.update_telegram_status(
                connected=self._connected,
                bot_id=self._bot_info.get("id"),
                bot_username=self._bot_info.get("username"),
                bot_name=self._bot_info.get("first_name"),
            )
        except Exception as e:
            logger.warning(f"[Telegram] Status broadcast failed: {e}")

    # =========================================================================
    # Send Methods
    # =========================================================================

    async def send_message(
        self,
        chat_id: str | int,
        text: str,
        parse_mode: Optional[str] = None,
        disable_notification: bool = False,
        reply_to_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a text message.

        Args:
            chat_id: Chat ID or @username
            text: Message text
            parse_mode: 'HTML', 'Markdown', or 'MarkdownV2'
            disable_notification: Send silently
            reply_to_message_id: Reply to this message

        Returns:
            Sent message info
        """
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        msg = await self._bot.send_message(
            chat_id=chat_id,
            text=text,
            parse_mode=parse_mode if parse_mode else None,
            disable_notification=disable_notification,
            reply_to_message_id=reply_to_message_id,
        )

        return {
            "message_id": msg.message_id,
            "chat_id": msg.chat.id,
            "date": msg.date.isoformat(),
            "text": msg.text,
        }

    async def send_photo(
        self,
        chat_id: str | int,
        photo: str,
        caption: Optional[str] = None,
        parse_mode: Optional[str] = None,
        disable_notification: bool = False,
        reply_to_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a photo.

        Args:
            chat_id: Chat ID or @username
            photo: URL or file_id
            caption: Photo caption
            parse_mode: Caption parse mode
            disable_notification: Send silently
            reply_to_message_id: Reply to this message

        Returns:
            Sent message info
        """
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        msg = await self._bot.send_photo(
            chat_id=chat_id,
            photo=photo,
            caption=caption,
            parse_mode=parse_mode if parse_mode else None,
            disable_notification=disable_notification,
            reply_to_message_id=reply_to_message_id,
        )

        return {
            "message_id": msg.message_id,
            "chat_id": msg.chat.id,
            "date": msg.date.isoformat(),
        }

    async def send_document(
        self,
        chat_id: str | int,
        document: str,
        caption: Optional[str] = None,
        parse_mode: Optional[str] = None,
        disable_notification: bool = False,
        reply_to_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a document.

        Args:
            chat_id: Chat ID or @username
            document: URL or file_id
            caption: Document caption
            parse_mode: Caption parse mode
            disable_notification: Send silently
            reply_to_message_id: Reply to this message

        Returns:
            Sent message info
        """
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        msg = await self._bot.send_document(
            chat_id=chat_id,
            document=document,
            caption=caption,
            parse_mode=parse_mode if parse_mode else None,
            disable_notification=disable_notification,
            reply_to_message_id=reply_to_message_id,
        )

        return {
            "message_id": msg.message_id,
            "chat_id": msg.chat.id,
            "date": msg.date.isoformat(),
        }

    async def send_location(
        self,
        chat_id: str | int,
        latitude: float,
        longitude: float,
        disable_notification: bool = False,
        reply_to_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a location.

        Args:
            chat_id: Chat ID or @username
            latitude: Latitude
            longitude: Longitude
            disable_notification: Send silently
            reply_to_message_id: Reply to this message

        Returns:
            Sent message info
        """
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        msg = await self._bot.send_location(
            chat_id=chat_id,
            latitude=latitude,
            longitude=longitude,
            disable_notification=disable_notification,
            reply_to_message_id=reply_to_message_id,
        )

        return {
            "message_id": msg.message_id,
            "chat_id": msg.chat.id,
            "date": msg.date.isoformat(),
        }

    async def send_contact(
        self,
        chat_id: str | int,
        phone_number: str,
        first_name: str,
        last_name: Optional[str] = None,
        disable_notification: bool = False,
        reply_to_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a contact.

        Args:
            chat_id: Chat ID or @username
            phone_number: Contact phone number
            first_name: Contact first name
            last_name: Contact last name
            disable_notification: Send silently
            reply_to_message_id: Reply to this message

        Returns:
            Sent message info
        """
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        msg = await self._bot.send_contact(
            chat_id=chat_id,
            phone_number=phone_number,
            first_name=first_name,
            last_name=last_name,
            disable_notification=disable_notification,
            reply_to_message_id=reply_to_message_id,
        )

        return {
            "message_id": msg.message_id,
            "chat_id": msg.chat.id,
            "date": msg.date.isoformat(),
        }

    async def get_me(self) -> Dict[str, Any]:
        """Get bot info."""
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        me = await self._bot.get_me()
        return {
            "id": me.id,
            "username": me.username,
            "first_name": me.first_name,
            "can_join_groups": me.can_join_groups,
        }

    async def get_chat(self, chat_id: str | int) -> Dict[str, Any]:
        """Get chat info.

        Args:
            chat_id: Chat ID or @username

        Returns:
            Chat info
        """
        if not self._bot:
            raise ValueError("Telegram bot not connected")

        chat = await self._bot.get_chat(chat_id)
        return {
            "id": chat.id,
            "type": chat.type,
            "title": chat.title,
            "username": chat.username,
            "first_name": chat.first_name,
            "last_name": chat.last_name,
            "description": chat.description,
        }


def get_telegram_service() -> TelegramService:
    """Get TelegramService singleton instance."""
    return TelegramService.get_instance()
