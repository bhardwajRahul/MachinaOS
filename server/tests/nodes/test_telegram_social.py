"""Contract tests for telegram_social nodes.

Covers: telegramSend, telegramReceive, socialSend, socialReceive.

These tests freeze the input -> output behaviour documented in
`docs-internal/node-logic-flows/telegram_social/`. A refactor that breaks any
of these indicates the docs (and the user-visible contract) must be updated.

All external boundaries are mocked:
  - TelegramService singleton is replaced via ``get_telegram_service`` patch.
  - event_waiter is patched at the module-attribute level inside both
    ``services.node_executor`` and ``services.handlers.triggers`` so the
    generic trigger path resolves a canned event without blocking.
  - The WhatsApp send router is patched for socialSend.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.nodes._mocks import patched_broadcaster, patched_container


pytestmark = pytest.mark.node_contract


# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #


def _make_telegram_service(*, connected: bool = True, owner_chat_id=None):
    """Build a stub TelegramService singleton mirroring the real interface."""
    svc = MagicMock(name="TelegramService")
    svc.connected = connected
    svc.owner_chat_id = owner_chat_id
    svc.set_owner = AsyncMock(return_value=None)
    svc.send_message = AsyncMock(
        return_value={
            "message_id": 42,
            "chat_id": 111,
            "date": "2026-04-15T00:00:00",
            "text": "hi",
        }
    )
    svc.send_photo = AsyncMock(
        return_value={"message_id": 43, "chat_id": 111, "date": "2026-04-15T00:00:00"}
    )
    svc.send_document = AsyncMock(
        return_value={"message_id": 44, "chat_id": 111, "date": "2026-04-15T00:00:00"}
    )
    svc.send_location = AsyncMock(
        return_value={"message_id": 45, "chat_id": 111, "date": "2026-04-15T00:00:00"}
    )
    svc.send_contact = AsyncMock(
        return_value={"message_id": 46, "chat_id": 111, "date": "2026-04-15T00:00:00"}
    )
    return svc


def _patch_telegram_service(svc):
    """Patch the get_telegram_service accessor everywhere it is imported."""
    return patch(
        "services.telegram_service.get_telegram_service", return_value=svc
    )


# ============================================================================
# telegramSend
# ============================================================================


class TestTelegramSend:
    async def test_text_happy_path_with_self_recipient(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=9999)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "text", "text": "hello"},
            )

        harness.assert_envelope(result, success=True)
        payload = result["result"]
        assert payload["message_id"] == 42
        assert payload["chat_id"] == 111
        assert payload["message_type"] == "text"
        svc.send_message.assert_awaited_once()
        call_kwargs = svc.send_message.await_args.kwargs
        assert call_kwargs["chat_id"] == 9999
        assert call_kwargs["text"] == "hello"

    async def test_not_connected_short_circuits(self, harness):
        svc = _make_telegram_service(connected=False)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "text", "text": "x"},
            )

        harness.assert_envelope(result, success=False)
        assert "not connected" in result["error"].lower()
        svc.send_message.assert_not_awaited()

    async def test_self_recipient_restores_owner_from_credentials(self, harness):
        # Service has no owner in memory, but credentials DB has one saved.
        svc = _make_telegram_service(connected=True, owner_chat_id=None)

        with _patch_telegram_service(svc), patched_container(
            auth_api_keys={"telegram_owner_chat_id": "7777"}
        ):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "text", "text": "hi"},
            )

        harness.assert_envelope(result, success=True)
        svc.set_owner.assert_awaited_once_with(7777)
        # send_message chat_id should be the restored owner id
        assert svc.send_message.await_args.kwargs["chat_id"] == 7777

    async def test_self_recipient_with_no_owner_returns_error(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=None)

        with _patch_telegram_service(svc), patched_container(auth_api_keys={}):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "text", "text": "hi"},
            )

        harness.assert_envelope(result, success=False)
        assert "owner" in result["error"].lower()
        svc.send_message.assert_not_awaited()

    async def test_user_recipient_requires_chat_id(self, harness):
        svc = _make_telegram_service(connected=True)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "user", "message_type": "text", "text": "x"},
            )

        harness.assert_envelope(result, success=False)
        assert "chat_id" in result["error"].lower()

    async def test_text_message_without_text_short_circuits(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=1)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "text"},
            )

        harness.assert_envelope(result, success=False)
        assert "text is required" in result["error"].lower()

    async def test_photo_requires_media_url(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=1)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "photo"},
            )

        harness.assert_envelope(result, success=False)
        assert "media_url" in result["error"].lower()

    async def test_photo_happy_path_passes_caption_and_parse_mode(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=1)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {
                    "recipient_type": "user",
                    "chat_id": "123",
                    "message_type": "photo",
                    "media_url": "https://example.com/x.jpg",
                    "caption": "ok",
                    "parse_mode": "HTML",
                    "silent": True,
                },
            )

        harness.assert_envelope(result, success=True)
        svc.send_photo.assert_awaited_once()
        kwargs = svc.send_photo.await_args.kwargs
        assert kwargs["photo"] == "https://example.com/x.jpg"
        assert kwargs["caption"] == "ok"
        assert kwargs["parse_mode"] == "HTML"
        assert kwargs["disable_notification"] is True

    async def test_location_requires_coordinates(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=1)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "location"},
            )

        harness.assert_envelope(result, success=False)
        assert "latitude" in result["error"].lower()

    async def test_unsupported_message_type(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=1)

        with _patch_telegram_service(svc):
            result = await harness.execute(
                "telegramSend",
                {"recipient_type": "self", "message_type": "hologram"},
            )

        harness.assert_envelope(result, success=False)
        assert "unsupported" in result["error"].lower()


# ============================================================================
# telegramReceive (trigger via generic handle_trigger_node + event_waiter)
# ============================================================================


def _make_waiter_stub(*, canned_event=None, is_trigger=True):
    """Fake event_waiter module with just the methods the trigger path calls."""
    waiter_obj = MagicMock(name="Waiter")
    waiter_obj.id = "waiter-test-id"

    stub = MagicMock(name="event_waiter_module")
    stub.is_trigger_node = MagicMock(return_value=is_trigger)
    stub.get_trigger_config = MagicMock(
        return_value=MagicMock(
            node_type="telegramReceive",
            event_type="telegram_message_received",
            display_name="Telegram Message",
        )
    )
    stub.register = AsyncMock(return_value=waiter_obj)
    stub.wait_for_event = AsyncMock(return_value=canned_event or {})
    stub.get_backend_mode = MagicMock(return_value="asyncio.Future")
    stub.cancel = MagicMock(return_value=True)
    stub.dispatch = MagicMock(return_value=1)
    return stub


class TestTelegramReceive:
    CANNED = {
        "message_id": 10,
        "chat_id": 555,
        "chat_type": "private",
        "chat_title": None,
        "from_id": 777,
        "from_username": "alice",
        "from_first_name": "Alice",
        "from_last_name": None,
        "is_bot": False,
        "text": "hello from alice",
        "content_type": "text",
        "date": "2026-04-15T12:00:00",
        "reply_to_message_id": None,
    }

    async def test_happy_path_returns_canned_event(self, harness):
        svc = _make_telegram_service(connected=True, owner_chat_id=42)
        waiter = _make_waiter_stub(canned_event=self.CANNED)

        with _patch_telegram_service(svc), patched_broadcaster(), patch(
            "services.node_executor.event_waiter", waiter
        ), patch("services.handlers.triggers.event_waiter", waiter):
            result = await harness.execute(
                "telegramReceive",
                {"senderFilter": "all", "contentTypeFilter": "all"},
            )

        harness.assert_envelope(result, success=True)
        assert result["result"]["text"] == "hello from alice"
        assert result["result"]["chat_id"] == 555
        waiter.register.assert_awaited_once()
        waiter.wait_for_event.assert_awaited_once()

    async def test_bot_not_connected_returns_error(self, harness):
        svc = _make_telegram_service(connected=False)
        waiter = _make_waiter_stub(canned_event=self.CANNED)

        with _patch_telegram_service(svc), patched_broadcaster(), patch(
            "services.node_executor.event_waiter", waiter
        ), patch("services.handlers.triggers.event_waiter", waiter):
            result = await harness.execute(
                "telegramReceive",
                {"senderFilter": "all"},
            )

        harness.assert_envelope(result, success=False)
        assert "not connected" in result["error"].lower()
        # Must NOT have registered a waiter when bot is offline
        waiter.register.assert_not_awaited()

    async def test_cancellation_propagates_as_error(self, harness):
        import asyncio

        svc = _make_telegram_service(connected=True, owner_chat_id=1)
        waiter = _make_waiter_stub()
        waiter.wait_for_event = AsyncMock(side_effect=asyncio.CancelledError())

        with _patch_telegram_service(svc), patched_broadcaster(), patch(
            "services.node_executor.event_waiter", waiter
        ), patch("services.handlers.triggers.event_waiter", waiter):
            result = await harness.execute(
                "telegramReceive",
                {"senderFilter": "all"},
            )

        harness.assert_envelope(result, success=False)
        assert "cancel" in result["error"].lower()


# ============================================================================
# socialSend
# ============================================================================


class TestSocialSend:
    async def test_whatsapp_text_happy_path(self, harness):
        whatsapp_send = AsyncMock(
            return_value={"success": True, "message_id": "wamid.xyz"}
        )

        with patch("routers.whatsapp.handle_whatsapp_send", whatsapp_send):
            result = await harness.execute(
                "socialSend",
                {
                    "channel": "whatsapp",
                    "recipientType": "phone",
                    "phone": "+15551234567",
                    "messageType": "text",
                    "message": "hi there",
                },
            )

        harness.assert_envelope(result, success=True)
        payload = result["result"]
        assert payload["channel"] == "whatsapp"
        assert payload["recipient"] == "+15551234567"
        assert payload["recipient_type"] == "phone"
        assert payload["message_type"] == "text"
        assert payload["message_id"] == "wamid.xyz"

        whatsapp_send.assert_awaited_once()
        sent_params = whatsapp_send.await_args.args[0]
        assert sent_params["phone"] == "+15551234567"
        assert sent_params["message"] == "hi there"
        assert sent_params["message_type"] == "text"

    async def test_missing_recipient_short_circuits(self, harness):
        # recipientType=phone but no phone param -> ValueError inside handler
        whatsapp_send = AsyncMock()

        with patch("routers.whatsapp.handle_whatsapp_send", whatsapp_send):
            result = await harness.execute(
                "socialSend",
                {
                    "channel": "whatsapp",
                    "recipientType": "phone",
                    "messageType": "text",
                    "message": "x",
                },
            )

        harness.assert_envelope(result, success=False)
        assert "recipient" in result["error"].lower()
        whatsapp_send.assert_not_awaited()

    async def test_unsupported_channel_returns_stub_error(self, harness):
        # Any non-whatsapp channel should surface as a failed envelope.
        whatsapp_send = AsyncMock()

        with patch("routers.whatsapp.handle_whatsapp_send", whatsapp_send):
            result = await harness.execute(
                "socialSend",
                {
                    "channel": "discord",
                    "recipientType": "user",
                    "userId": "u1",
                    "messageType": "text",
                    "message": "hi",
                },
            )

        harness.assert_envelope(result, success=False)
        assert "discord" in result["error"].lower() or "not yet implemented" in result["error"].lower()
        whatsapp_send.assert_not_awaited()

    async def test_whatsapp_failure_becomes_error_envelope(self, harness):
        whatsapp_send = AsyncMock(
            return_value={"success": False, "error": "rpc boom"}
        )

        with patch("routers.whatsapp.handle_whatsapp_send", whatsapp_send):
            result = await harness.execute(
                "socialSend",
                {
                    "channel": "whatsapp",
                    "recipientType": "phone",
                    "phone": "+15551234567",
                    "messageType": "text",
                    "message": "x",
                },
            )

        harness.assert_envelope(result, success=False)
        assert "rpc boom" in result["error"]


# ============================================================================
# socialReceive
# ============================================================================


class TestSocialReceive:
    async def test_normalizes_whatsapp_upstream(self, harness):
        upstream = {
            "message_id": "wamid.abc",
            "sender": "15551234567@s.whatsapp.net",
            "sender_phone": "15551234567",
            "push_name": "Alice",
            "chat_id": "15551234567@s.whatsapp.net",
            "text": "hi from wa",
            "message_type": "text",
            "is_group": False,
            "is_from_me": False,
            "timestamp": "2026-04-15T00:00:00",
        }

        nodes = [
            {"id": "src_wa", "type": "whatsappReceive"},
            {"id": "tgt_social", "type": "socialReceive"},
        ]
        edges = [
            {
                "source": "src_wa",
                "target": "tgt_social",
                "sourceHandle": "output-main",
                "targetHandle": "input-main",
            }
        ]
        upstream_outputs = {"src_wa::output_main": upstream}

        result = await harness.execute(
            "socialReceive",
            {"channelFilter": "all", "senderFilter": "all"},
            node_id="tgt_social",
            nodes=nodes,
            edges=edges,
            upstream_outputs=upstream_outputs,
        )

        harness.assert_envelope(result, success=True)
        payload = result["result"]
        # Handler-built slices
        assert payload["message"] == "hi from wa"
        assert payload["contact"]["sender_phone"] == "15551234567"
        assert payload["contact"]["channel"] == "whatsapp"
        assert payload["metadata"]["message_id"] == "wamid.abc"
        # Top-level unified fields (from spread)
        assert payload["channel"] == "whatsapp"
        assert payload["chat_type"] == "dm"

    async def test_missing_upstream_returns_error(self, harness):
        nodes = [
            {"id": "src_wa", "type": "whatsappReceive"},
            {"id": "tgt_social", "type": "socialReceive"},
        ]
        # No edges / upstream outputs -> handler gets {} and errors out.
        result = await harness.execute(
            "socialReceive",
            {},
            node_id="tgt_social",
            nodes=nodes,
            edges=[],
            upstream_outputs={},
        )

        harness.assert_envelope(result, success=False)
        assert "no message data" in result["error"].lower()

    async def test_filter_rejects_message(self, harness):
        upstream = {
            "message_id": "m1",
            "sender": "15550000000@s.whatsapp.net",
            "sender_phone": "15550000000",
            "push_name": "Bob",
            "chat_id": "c1",
            "text": "spam spam",
            "message_type": "text",
            "is_group": False,
            "is_from_me": False,
        }
        nodes = [
            {"id": "src_wa", "type": "whatsappReceive"},
            {"id": "tgt_social", "type": "socialReceive"},
        ]
        edges = [
            {
                "source": "src_wa",
                "target": "tgt_social",
                "sourceHandle": "output-main",
                "targetHandle": "input-main",
            }
        ]
        upstream_outputs = {"src_wa::output_main": upstream}

        result = await harness.execute(
            "socialReceive",
            {
                "channelFilter": "all",
                "senderFilter": "keywords",
                "keywords": "hello,hi",
            },
            node_id="tgt_social",
            nodes=nodes,
            edges=edges,
            upstream_outputs=upstream_outputs,
        )

        # Filtered messages return success=true with result=null and filtered=true
        harness.assert_envelope(result, success=True)
        assert result["result"] is None
        assert result.get("filtered") is True

    async def test_ignore_own_messages_default(self, harness):
        upstream = {
            "message_id": "m1",
            "sender": "self@s.whatsapp.net",
            "sender_phone": "self",
            "chat_id": "c1",
            "text": "echo",
            "message_type": "text",
            "is_group": False,
            "is_from_me": True,
        }
        nodes = [
            {"id": "src_wa", "type": "whatsappReceive"},
            {"id": "tgt_social", "type": "socialReceive"},
        ]
        edges = [
            {
                "source": "src_wa",
                "target": "tgt_social",
                "sourceHandle": "output-main",
                "targetHandle": "input-main",
            }
        ]
        upstream_outputs = {"src_wa::output_main": upstream}

        result = await harness.execute(
            "socialReceive",
            {"senderFilter": "all"},  # ignoreOwnMessages default true
            node_id="tgt_social",
            nodes=nodes,
            edges=edges,
            upstream_outputs=upstream_outputs,
        )

        harness.assert_envelope(result, success=True)
        assert result["result"] is None
        assert result.get("filtered") is True
