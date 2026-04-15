"""Telegram bot-token credential (Wave 11.E)."""

from __future__ import annotations

from services.plugin.credential import ApiKeyCredential


class TelegramCredential(ApiKeyCredential):
    id = "telegram_bot_token"
    display_name = "Telegram Bot"
    category = "Social"
    icon = "asset:telegram"
    key_name = ""  # not used — python-telegram-bot takes the token directly
    key_location = "header"
    extra_fields = ("telegram_owner_chat_id",)
    docs_url = "https://core.telegram.org/bots"
