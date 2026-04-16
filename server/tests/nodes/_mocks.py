"""Reusable mocks and patches for node handler tests.

Most handlers reach out to global singletons via `from core.container import container`
or `from services.X import get_X`. These helpers patch those entry points so tests
remain hermetic.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------- container patches ---------------------- #


@contextmanager
def patched_container(
    *,
    auth_api_keys: Optional[Dict[str, str]] = None,
    auth_oauth_tokens: Optional[Dict[str, Dict[str, Any]]] = None,
    database: Optional[MagicMock] = None,
    ai_service: Optional[Any] = None,
    android_service: Optional[Any] = None,
    maps_service: Optional[Any] = None,
    text_service: Optional[Any] = None,
) -> Iterator[MagicMock]:
    """Patch `core.container.container` so handlers see canned credentials and DB.

    Scaling-branch plugins resolve services via
    `from core.container import container; svc = container.X()` inside the
    plugin body, so the NodeExecutor-injected services on `harness.X` are
    orphaned unless we also wire them onto the container mock here.

    Args:
        auth_api_keys: Map of provider -> api_key string returned by get_api_key.
        auth_oauth_tokens: Map of provider -> token dict returned by get_oauth_tokens.
        database: Optional MagicMock to use as the database; defaults to a stub.
        ai_service / android_service / maps_service / text_service: Optional
            service instances that `container.X()` should return. Pass the
            harness's pre-wired mocks so assertions on `harness.ai_service.
            execute_chat.assert_awaited_once()` survive plugin dispatch.

    Yields:
        The patched container MagicMock so tests can inspect calls.
    """
    api_keys = auth_api_keys or {}
    oauth_tokens = auth_oauth_tokens or {}

    auth_service = MagicMock(name="AuthService")
    auth_service.get_api_key = AsyncMock(side_effect=lambda provider, *a, **kw: api_keys.get(provider))
    auth_service.get_oauth_tokens = AsyncMock(
        side_effect=lambda provider, *a, **kw: oauth_tokens.get(provider)
    )
    auth_service.get_stored_models = AsyncMock(return_value=[])
    # Awaitable async writes (handlers like Twitter call these in refresh paths)
    auth_service.store_api_key = AsyncMock(return_value=True)
    auth_service.store_oauth_tokens = AsyncMock(return_value=True)
    auth_service.remove_oauth_tokens = AsyncMock(return_value=True)
    auth_service.delete_api_key = AsyncMock(return_value=True)

    db_mock = database or MagicMock(name="Database")
    if database is None:
        db_mock.save_api_usage_metric = AsyncMock(return_value=None)
        db_mock.add_token_usage_metric = AsyncMock(return_value=None)
        db_mock.get_node_parameters = AsyncMock(return_value={})
        db_mock.save_node_parameters = AsyncMock(return_value=None)

    container_mock = MagicMock(name="Container")
    container_mock.auth_service = MagicMock(return_value=auth_service)
    container_mock.database = MagicMock(return_value=db_mock)

    if ai_service is not None:
        container_mock.ai_service = MagicMock(return_value=ai_service)
    if android_service is not None:
        container_mock.android_service = MagicMock(return_value=android_service)
    if maps_service is not None:
        container_mock.maps_service = MagicMock(return_value=maps_service)
    if text_service is not None:
        container_mock.text_service = MagicMock(return_value=text_service)

    with patch("core.container.container", container_mock):
        yield container_mock


# ---------------------- pricing service patch ---------------------- #


@contextmanager
def patched_pricing(total_cost: float = 0.001) -> Iterator[MagicMock]:
    """Patch `services.pricing.get_pricing_service` to return canned cost data."""
    pricing = MagicMock(name="PricingService")
    pricing.calculate_api_cost = MagicMock(
        return_value={"operation": "test", "total_cost": total_cost}
    )
    pricing.calculate_cost = MagicMock(
        return_value={
            "input_cost": 0.0,
            "output_cost": 0.0,
            "cache_cost": 0.0,
            "total_cost": total_cost,
        }
    )
    with patch("services.pricing.get_pricing_service", return_value=pricing):
        yield pricing


# ---------------------- status broadcaster patch ---------------------- #


@contextmanager
def patched_broadcaster() -> Iterator[MagicMock]:
    """Patch the StatusBroadcaster singleton so handlers can broadcast freely.

    Returns the broadcaster mock so tests can assert on calls like
    update_node_status, broadcast_terminal_log, send_custom_event, etc.
    """
    broadcaster = MagicMock(name="StatusBroadcaster")
    for method in (
        "update_node_status",
        "update_workflow_status",
        "broadcast_terminal_log",
        "broadcast_console_log",
        "send_custom_event",
        "broadcast_message",
        "_broadcast",
    ):
        setattr(broadcaster, method, AsyncMock(return_value=None))

    with patch(
        "services.status_broadcaster.get_status_broadcaster",
        return_value=broadcaster,
    ):
        yield broadcaster


# ---------------------- event waiter patch ---------------------- #


@contextmanager
def patched_event_waiter(canned_event: Optional[Dict[str, Any]] = None) -> Iterator[MagicMock]:
    """Patch event_waiter so trigger nodes resolve immediately with canned data.

    Args:
        canned_event: Event payload to return from wait_for_event. Default is
            an empty dict so trigger handlers complete without blocking.
    """
    event_data = canned_event if canned_event is not None else {}

    waiter_mock = MagicMock(name="event_waiter")
    waiter_mock.is_trigger_node = MagicMock(return_value=True)
    waiter_mock.register = MagicMock(return_value=MagicMock(id="waiter-test-id"))
    waiter_mock.wait_for_event = AsyncMock(return_value=event_data)
    waiter_mock.cancel = MagicMock(return_value=True)
    waiter_mock.dispatch = MagicMock(return_value=1)
    waiter_mock.get_trigger_config = MagicMock(
        return_value=MagicMock(
            node_type="testTrigger",
            event_type="test_event",
            display_name="Test Trigger",
        )
    )

    with patch("services.event_waiter", waiter_mock):
        yield waiter_mock


# ---------------------- subprocess patch ---------------------- #


@contextmanager
def patched_subprocess(
    *,
    stdout: bytes = b"",
    stderr: bytes = b"",
    returncode: int = 0,
) -> Iterator[MagicMock]:
    """Patch asyncio.create_subprocess_exec for shell/process_manager/browser handlers."""
    proc = MagicMock(name="Subprocess")
    proc.returncode = returncode
    proc.communicate = AsyncMock(return_value=(stdout, stderr))
    proc.wait = AsyncMock(return_value=returncode)
    proc.terminate = MagicMock(return_value=None)
    proc.kill = MagicMock(return_value=None)
    proc.pid = 12345
    proc.stdout = MagicMock()
    proc.stdout.readline = AsyncMock(return_value=b"")
    proc.stderr = MagicMock()
    proc.stderr.readline = AsyncMock(return_value=b"")

    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        yield proc
