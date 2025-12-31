"""Event Waiter Service - Generic event waiting for trigger nodes.

Supports any trigger type (WhatsApp, Email, Webhook, MQTT, etc.)
Uses Redis Streams when available for persistence, falls back to asyncio.Future.

Architecture:
- Redis mode: Events stored in Redis Streams, waiters poll streams with blocking XREAD
- Memory mode: Events dispatched to in-memory asyncio.Future waiters
"""
import asyncio
import json
import uuid
import time
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Callable, List, TYPE_CHECKING

from core.logging import get_logger

if TYPE_CHECKING:
    from core.cache import CacheService

logger = get_logger(__name__)


# =============================================================================
# CACHE SERVICE REFERENCE
# =============================================================================

_cache_service: Optional["CacheService"] = None
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_cache_service(cache: "CacheService") -> None:
    """Set the cache service for Redis Streams support.

    Called during application startup from main.py.
    """
    global _cache_service, _main_loop
    _cache_service = cache
    # Store reference to the main event loop for thread-safe dispatch
    try:
        _main_loop = asyncio.get_running_loop()
    except RuntimeError:
        _main_loop = None
    mode = "Redis Streams" if cache and cache.is_redis_available() else "asyncio.Future"
    logger.info(f"[EventWaiter] Initialized with {mode} backend")


def get_cache_service() -> Optional["CacheService"]:
    """Get the cache service if available."""
    return _cache_service


def is_redis_mode() -> bool:
    """Check if Redis Streams mode is active.

    Returns True only if Redis is connected AND supports Streams commands.
    This prevents runtime failures when Redis doesn't support XREADGROUP/XADD.
    """
    return _cache_service is not None and _cache_service.is_streams_available()


# =============================================================================
# LID TO PHONE RESOLUTION CACHE
# =============================================================================

# Cache: group_jid -> {lid -> phone}
# TTL: 5 minutes (group membership can change)
_lid_phone_cache: Dict[str, Dict[str, str]] = {}
_lid_cache_timestamps: Dict[str, float] = {}
LID_CACHE_TTL = 300  # 5 minutes


async def resolve_lid_to_phone(group_jid: str, lid: str) -> Optional[str]:
    """Resolve a LID to phone number using cached group info.

    Args:
        group_jid: The group JID (e.g., '120363422738675920@g.us')
        lid: The LID to resolve (e.g., '201872623300767@lid' or just '201872623300767')

    Returns:
        Phone number if found, None otherwise
    """
    # Normalize LID (remove @lid suffix if present)
    lid_key = lid.split('@')[0] if '@' in lid else lid

    # Check cache validity
    if group_jid in _lid_phone_cache:
        cache_time = _lid_cache_timestamps.get(group_jid, 0)
        if time.time() - cache_time < LID_CACHE_TTL:
            phone = _lid_phone_cache[group_jid].get(lid_key)
            if phone:
                return phone

    # Cache miss or expired - fetch group info
    await refresh_group_lid_cache(group_jid)

    # Try again from cache
    if group_jid in _lid_phone_cache:
        phone = _lid_phone_cache[group_jid].get(lid_key)
        if phone:
            return phone

    logger.warning(f"[LIDResolver] Could not resolve LID {lid_key} in group {group_jid}")
    return None


async def refresh_group_lid_cache(group_jid: str) -> bool:
    """Fetch group info and cache LID->phone mappings.

    Args:
        group_jid: The group JID to fetch info for

    Returns:
        True if successful, False otherwise
    """
    try:
        from routers.whatsapp import get_client

        client = await get_client()
        result = await client.call("group_info", {"group_id": group_jid})

        if not result or 'participants' not in result:
            logger.warning(f"[LIDResolver] No participants in group_info for {group_jid}")
            return False

        # Build LID->phone mapping
        lid_map: Dict[str, str] = {}
        for participant in result.get('participants', []):
            jid = participant.get('jid', '')
            phone = participant.get('phone', '')

            if jid and phone:
                # Extract LID key (number before @)
                lid_key = jid.split('@')[0] if '@' in jid else jid
                lid_map[lid_key] = phone
                logger.debug(f"[LIDResolver] Cached: {lid_key} -> {phone}")

        _lid_phone_cache[group_jid] = lid_map
        _lid_cache_timestamps[group_jid] = time.time()

        logger.debug(f"[LIDResolver] Cached {len(lid_map)} participants for group {group_jid}")
        return True

    except Exception as e:
        logger.error(f"[LIDResolver] Failed to fetch group info for {group_jid}: {e}")
        return False


def get_cached_phone(group_jid: str, lid: str) -> Optional[str]:
    """Get phone from cache synchronously (for use in filter function).

    Args:
        group_jid: The group JID
        lid: The LID to look up

    Returns:
        Phone number if cached, None otherwise
    """
    lid_key = lid.split('@')[0] if '@' in lid else lid

    if group_jid in _lid_phone_cache:
        cache_time = _lid_cache_timestamps.get(group_jid, 0)
        if time.time() - cache_time < LID_CACHE_TTL:
            return _lid_phone_cache[group_jid].get(lid_key)

    return None


# =============================================================================
# TRIGGER CONFIGURATION REGISTRY
# =============================================================================

@dataclass
class TriggerConfig:
    """Configuration for a trigger node type."""
    node_type: str
    event_type: str  # Event to wait for (e.g., 'whatsapp_message_received')
    display_name: str


# Registry of supported trigger types (event-based triggers only)
# Note: cronScheduler is NOT an event-based trigger - it uses APScheduler directly
TRIGGER_REGISTRY: Dict[str, TriggerConfig] = {
    'start': TriggerConfig(
        node_type='start',
        event_type='deploy_triggered',
        display_name='Deploy Start'
    ),
    'whatsappReceive': TriggerConfig(
        node_type='whatsappReceive',
        event_type='whatsapp_message_received',
        display_name='WhatsApp Message'
    ),
    'webhookTrigger': TriggerConfig(
        node_type='webhookTrigger',
        event_type='webhook_received',
        display_name='Webhook Request'
    ),
    # Future triggers - just add to registry:
    # 'emailTrigger': TriggerConfig('emailTrigger', 'email_received', 'Email'),
    # 'mqttTrigger': TriggerConfig('mqttTrigger', 'mqtt_message', 'MQTT Message'),
    # 'telegramTrigger': TriggerConfig('telegramTrigger', 'telegram_message', 'Telegram'),
}


def is_trigger_node(node_type: str) -> bool:
    """Check if a node type is a trigger node (workflow starting point).

    Uses constants.WORKFLOW_TRIGGER_TYPES for comprehensive trigger detection.
    This includes all trigger types: start, cronScheduler, and event-based triggers.
    """
    from constants import WORKFLOW_TRIGGER_TYPES
    return node_type in WORKFLOW_TRIGGER_TYPES


def is_event_trigger_node(node_type: str) -> bool:
    """Check if a node type is an event-based trigger (waits for events).

    Event-based triggers are registered in TRIGGER_REGISTRY and wait for
    external events to fire. This excludes 'start' and 'cronScheduler' which
    have their own execution mechanisms.
    """
    return node_type in TRIGGER_REGISTRY


def get_trigger_config(node_type: str) -> Optional[TriggerConfig]:
    """Get trigger configuration for a node type."""
    return TRIGGER_REGISTRY.get(node_type)


# =============================================================================
# FILTER BUILDERS - One per trigger type
# =============================================================================

def build_whatsapp_filter(params: Dict) -> Callable[[Dict], bool]:
    """Build filter function for WhatsApp messages.

    Based on schema.json event.message_received fields:
    - message_type: text, image, video, audio, document, sticker, location, contact, contacts
    - sender: Sender JID (e.g., 1234567890@s.whatsapp.net for DMs, or LID like 123@lid for groups)
    - chat_id: Chat JID (same as sender for DMs, group JID for groups)
    - is_from_me: boolean - true if sent by connected account
    - is_group: boolean - true if message is in a group chat
    - is_forwarded: boolean - true if message is forwarded
    - text: text content (for text messages)
    - group_info: { group_jid, sender_jid, sender_name } - present for group messages
      - sender_jid may be LID format, use LID cache to resolve to real phone
    """
    msg_type = params.get('messageTypeFilter', 'all')
    sender_filter = params.get('filter', 'all')
    contact_phone = params.get('contactPhone', '')
    group_id = params.get('group_id') or params.get('groupId', '')
    sender_number = params.get('senderNumber', '')  # Optional sender filter within group
    keywords = [k.strip().lower() for k in params.get('keywords', '').split(',') if k.strip()]
    ignore_own = params.get('ignoreOwnMessages', True)
    forwarded_filter = params.get('forwardedFilter', 'all')  # 'all', 'only_forwarded', 'ignore_forwarded'

    logger.debug(f"[WhatsAppFilter] Built: type={msg_type}, filter={sender_filter}, group_id='{group_id}', forwarded={forwarded_filter}")

    def matches(m: Dict) -> bool:
        msg_chat_id = m.get('chat_id', '')
        msg_sender = m.get('sender', '')
        group_info = m.get('group_info', {})
        is_group = m.get('is_group', False)

        # For group messages, try to resolve LID to phone using cache
        sender_jid = group_info.get('sender_jid', '') if is_group else msg_sender
        sender_phone = ''

        if is_group and sender_jid:
            # Check if sender_jid is a LID (ends with @lid)
            if '@lid' in sender_jid:
                # Try to get resolved phone from cache
                cached_phone = get_cached_phone(msg_chat_id, sender_jid)
                if cached_phone:
                    sender_phone = cached_phone
                else:
                    # LID not in cache, extract number part as fallback
                    sender_phone = sender_jid.split('@')[0] if '@' in sender_jid else sender_jid
            else:
                # Not a LID, extract phone from JID
                sender_phone = sender_jid.split('@')[0] if '@' in sender_jid else sender_jid
        else:
            # DM - extract phone from sender
            sender_phone = msg_sender.split('@')[0] if '@' in msg_sender else msg_sender

        # Message type filter (schema field: message_type)
        if msg_type != 'all' and m.get('message_type') != msg_type:
            return False

        # Sender filter - for contact filter, use actual phone number
        if sender_filter == 'any_contact':
            # Only accept non-group messages (individual/contact messages)
            if is_group:
                return False

        if sender_filter == 'contact':
            if contact_phone not in sender_phone:
                return False

        if sender_filter == 'group':
            # For group filter, check if message is from that group
            if not is_group:
                return False
            if msg_chat_id != group_id:
                return False
            # Optional: filter by specific sender within group using resolved phone number
            if sender_number:
                if sender_number not in sender_phone:
                    return False

        if sender_filter == 'keywords':
            text = (m.get('text') or '').lower()
            if not any(kw in text for kw in keywords):
                return False

        # Ignore own messages (schema field: is_from_me)
        if ignore_own and m.get('is_from_me'):
            return False

        # Forwarded message filter (schema field: is_forwarded)
        is_forwarded = m.get('is_forwarded', False)
        logger.debug(f"[WhatsAppFilter] Forwarded check: filter={forwarded_filter}, is_forwarded={is_forwarded}, raw_value={m.get('is_forwarded')}")
        if forwarded_filter == 'only_forwarded' and not is_forwarded:
            logger.debug(f"[WhatsAppFilter] Rejected: only_forwarded but message is not forwarded")
            return False
        if forwarded_filter == 'ignore_forwarded' and is_forwarded:
            logger.debug(f"[WhatsAppFilter] Rejected: ignore_forwarded but message is forwarded")
            return False

        logger.debug(f"[WhatsAppFilter] Matched message from {sender_phone}")
        return True

    return matches


def build_webhook_filter(params: Dict) -> Callable[[Dict], bool]:
    """Build filter function for webhook requests.

    Filters by webhook path to ensure the event is for the correct trigger node.

    Args:
        params: Node parameters with 'path' field

    Returns:
        Filter function that checks if event path matches
    """
    webhook_path = params.get('path', '')

    def matches(data: Dict) -> bool:
        event_path = data.get('path', '')
        if webhook_path and event_path != webhook_path:
            return False
        return True

    return matches


# Registry of filter builders per trigger type
FILTER_BUILDERS: Dict[str, Callable[[Dict], Callable[[Dict], bool]]] = {
    'whatsappReceive': build_whatsapp_filter,
    'webhookTrigger': build_webhook_filter,
}


def build_filter(node_type: str, params: Dict) -> Callable[[Dict], bool]:
    """Build a filter function for the given trigger type and parameters."""
    builder = FILTER_BUILDERS.get(node_type)
    if builder:
        return builder(params)
    # Default: accept all events
    return lambda x: True


# =============================================================================
# WAITER DATA STRUCTURES
# =============================================================================

@dataclass
class Waiter:
    """Single event waiter.

    In memory mode: uses asyncio.Future
    In Redis mode: uses stream polling with stored metadata
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    node_id: str = ""
    node_type: str = ""
    event_type: str = ""
    params: Dict = field(default_factory=dict)  # Store params for Redis mode filter rebuild
    filter_fn: Callable[[Dict], bool] = field(default_factory=lambda: lambda x: True)
    future: Optional[asyncio.Future] = None  # Only used in memory mode
    cancelled: bool = False
    created_at: float = field(default_factory=time.time)


# Module-level waiter storage (used in both modes for tracking)
_waiters: Dict[str, Waiter] = {}

# Redis stream names
EVENTS_STREAM_PREFIX = "events:"
WAITERS_KEY_PREFIX = "waiters:"
# NOTE: Each waiter uses its own consumer group to ensure ALL waiters receive ALL messages.
# Redis consumer groups deliver each message to only ONE consumer in the group.
# For trigger nodes, we want broadcast semantics where every waiter evaluates every event.
CONSUMER_GROUP_PREFIX = "waiter_group_"  # Each waiter gets: waiter_group_{waiter_id}


def _get_stream_name(event_type: str) -> str:
    """Get Redis stream name for event type."""
    return f"{EVENTS_STREAM_PREFIX}{event_type}"


# =============================================================================
# WAITER REGISTRATION
# =============================================================================

async def register(node_type: str, node_id: str, params: Dict) -> Waiter:
    """Register a waiter for a trigger node.

    Args:
        node_type: Type of trigger node (e.g., 'whatsappReceive')
        node_id: ID of the node waiting
        params: Node parameters for building filter

    Returns:
        Waiter object to await
    """
    config = get_trigger_config(node_type)
    if not config:
        raise ValueError(f"Unknown trigger type: {node_type}")

    # Note: LID cache for group sender resolution is populated lazily on first message
    # We don't pre-fetch here to avoid blocking deployment with sequential RPC calls
    if node_type == 'whatsappReceive':
        filter_type = params.get('filter', 'all')
        group_id = params.get('group_id') or params.get('groupId', '')
        sender_number = params.get('senderNumber', '')

        if filter_type == 'group' and group_id and sender_number:
            logger.debug(f"[EventWaiter] Group filter with sender: {group_id}, sender: {sender_number}")

    # Create waiter
    waiter = Waiter(
        node_id=node_id,
        node_type=node_type,
        event_type=config.event_type,
        params=params,
        filter_fn=build_filter(node_type, params),
    )

    if is_redis_mode():
        # Redis mode: store waiter metadata in Redis
        cache = get_cache_service()
        waiter_key = f"{WAITERS_KEY_PREFIX}{waiter.id}"

        # Each waiter gets its own consumer group for broadcast semantics
        # This ensures ALL waiters receive ALL messages (not load-balanced)
        consumer_group = f"{CONSUMER_GROUP_PREFIX}{waiter.id}"

        waiter_data = {
            "id": waiter.id,
            "node_id": node_id,
            "node_type": node_type,
            "event_type": config.event_type,
            "params": json.dumps(params),
            "created_at": waiter.created_at,
            "consumer_group": consumer_group,  # Store for cleanup
        }
        await cache.set(waiter_key, waiter_data, ttl=86400)  # 24 hour TTL

        # Create unique consumer group for this waiter
        # start_id='$' means only new messages from this point forward
        stream_name = _get_stream_name(config.event_type)
        await cache.stream_create_group(stream_name, consumer_group, start_id='$')

        logger.debug(f"[EventWaiter] Registered {node_type} waiter {waiter.id} (Redis)")
    else:
        # Memory mode: create asyncio.Future
        try:
            loop = asyncio.get_running_loop()
            waiter.future = loop.create_future()
        except RuntimeError:
            waiter.future = asyncio.get_event_loop().create_future()

        logger.debug(f"[EventWaiter] Registered {node_type} waiter {waiter.id}")

    _waiters[waiter.id] = waiter
    return waiter


async def wait_for_event(waiter: Waiter, timeout: Optional[float] = None) -> Dict:
    """Wait for an event matching the waiter's filter.

    Args:
        waiter: The registered waiter
        timeout: Optional timeout in seconds (None = wait forever)

    Returns:
        Event data when matched

    Raises:
        asyncio.CancelledError: If waiter was cancelled
        asyncio.TimeoutError: If timeout exceeded
    """
    if is_redis_mode():
        return await _wait_redis(waiter, timeout)
    else:
        return await _wait_memory(waiter, timeout)


async def _wait_memory(waiter: Waiter, timeout: Optional[float]) -> Dict:
    """Wait using asyncio.Future (memory mode)."""
    if waiter.future is None:
        raise RuntimeError("Waiter has no Future (memory mode not initialized)")

    try:
        if timeout:
            return await asyncio.wait_for(waiter.future, timeout)
        else:
            return await waiter.future
    except asyncio.CancelledError:
        _cleanup_waiter(waiter.id)
        raise


async def _wait_redis(waiter: Waiter, timeout: Optional[float]) -> Dict:
    """Wait using Redis Streams polling.

    Polls the event stream with blocking XREAD, checking each message against the filter.
    Each waiter has its own consumer group for broadcast semantics.
    """
    cache = get_cache_service()
    stream_name = _get_stream_name(waiter.event_type)

    # Use waiter-specific consumer group for broadcast (all waiters see all messages)
    consumer_group = f"{CONSUMER_GROUP_PREFIX}{waiter.id}"
    consumer_name = f"consumer_{waiter.id}"

    # Start reading from now (new messages only)
    last_id = '$'
    block_ms = 5000  # 5 second blocks to allow cancellation checks

    start_time = time.time()

    while not waiter.cancelled:
        # Check timeout
        if timeout and (time.time() - start_time) > timeout:
            raise asyncio.TimeoutError(f"Waiter {waiter.id} timed out after {timeout}s")

        # Read from stream with blocking using waiter's own consumer group
        try:
            result = await cache.stream_read_group(
                consumer_group,  # Each waiter has its own group
                consumer_name,
                {stream_name: '>'},  # '>' = new messages for this consumer
                count=10,
                block=block_ms
            )

            if not result:
                # No messages, continue polling
                continue

            # Process messages
            for stream_data in result:
                stream, messages = stream_data
                for msg_id, fields in messages:
                    # Deserialize event data
                    event_data = {}
                    for k, v in fields.items():
                        try:
                            event_data[k] = json.loads(v)
                        except (json.JSONDecodeError, TypeError):
                            event_data[k] = v

                    # Check filter
                    if waiter.filter_fn(event_data):
                        # Match found - acknowledge and return
                        await cache.stream_ack(stream_name, consumer_group, msg_id)
                        _cleanup_waiter(waiter.id)
                        logger.info(f"[EventWaiter] Waiter {waiter.id} matched event {msg_id}")
                        return event_data
                    else:
                        # No match - acknowledge but continue waiting
                        await cache.stream_ack(stream_name, consumer_group, msg_id)

        except asyncio.CancelledError:
            _cleanup_waiter(waiter.id)
            raise

    # Waiter was cancelled via cancel() flag
    _cleanup_waiter(waiter.id)
    raise asyncio.CancelledError(f"Waiter {waiter.id} cancelled")


def _cleanup_waiter(waiter_id: str) -> None:
    """Remove waiter from storage."""
    _waiters.pop(waiter_id, None)

    # Also remove from Redis if in Redis mode
    if is_redis_mode():
        cache = get_cache_service()
        waiter_key = f"{WAITERS_KEY_PREFIX}{waiter_id}"
        asyncio.create_task(cache.delete(waiter_key))


# =============================================================================
# EVENT DISPATCH
# =============================================================================

async def dispatch_async(event_type: str, data: Dict) -> int:
    """Dispatch event asynchronously (for Redis mode).

    Args:
        event_type: Type of event (e.g., 'whatsapp_message_received')
        data: Event data

    Returns:
        1 if event was added to stream, 0 otherwise
    """
    logger.debug(f"[EventWaiter] dispatch_async: event_type='{event_type}'")

    if is_redis_mode():
        cache = get_cache_service()
        stream_name = _get_stream_name(event_type)
        msg_id = await cache.stream_add(stream_name, data)
        if msg_id:
            logger.debug(f"[EventWaiter] Added event to stream {stream_name}: {msg_id}")
            return 1
        return 0
    else:
        # Fall back to sync dispatch for memory mode
        return dispatch(event_type, data)


def dispatch(event_type: str, data: Dict) -> int:
    """Dispatch event to matching waiters (synchronous, memory mode).

    Thread-safe: Can be called from APScheduler threads or async context.

    Args:
        event_type: Type of event (e.g., 'whatsapp_message_received')
        data: Event data

    Returns:
        Number of waiters resolved
    """
    if is_redis_mode():
        # In Redis mode, use async dispatch
        # Handle both async context and thread context (e.g., APScheduler callbacks)
        try:
            # Try to get the current running loop
            loop = asyncio.get_running_loop()
            # We're in an async context - schedule task normally
            asyncio.create_task(dispatch_async(event_type, data))
        except RuntimeError:
            # No running loop - we're in a thread (e.g., APScheduler callback)
            # Use the stored main loop with thread-safe dispatch
            if _main_loop is not None and _main_loop.is_running():
                asyncio.run_coroutine_threadsafe(dispatch_async(event_type, data), _main_loop)
            else:
                logger.warning(f"[EventWaiter] No event loop available for dispatch of {event_type}")
        return 0  # Actual resolution happens in _wait_redis

    resolved = 0
    to_remove = []

    for wid, w in _waiters.items():
        if w.event_type == event_type and w.future and not w.future.done():
            try:
                if w.filter_fn(data):
                    w.future.set_result(data)
                    to_remove.append(wid)
                    resolved += 1
                    logger.debug(f"[EventWaiter] Resolved {w.node_type} waiter {wid}")
            except Exception as e:
                logger.error(f"[EventWaiter] Filter error for waiter {wid}: {e}")

    for wid in to_remove:
        _waiters.pop(wid, None)

    return resolved


# =============================================================================
# WAITER CANCELLATION
# =============================================================================

def cancel(waiter_id: str) -> bool:
    """Cancel a waiter by ID."""
    if w := _waiters.pop(waiter_id, None):
        w.cancelled = True

        if w.future and not w.future.done():
            w.future.cancel()

        # Also remove from Redis if in Redis mode
        if is_redis_mode():
            cache = get_cache_service()
            waiter_key = f"{WAITERS_KEY_PREFIX}{waiter_id}"
            asyncio.create_task(cache.delete(waiter_key))

        logger.debug(f"[EventWaiter] Cancelled waiter {waiter_id}")
        return True

    return False


def cancel_for_node(node_id: str) -> int:
    """Cancel all waiters for a node."""
    to_cancel = [wid for wid, w in _waiters.items() if w.node_id == node_id]
    for wid in to_cancel:
        cancel(wid)
    return len(to_cancel)


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_active_waiters() -> List[Dict[str, Any]]:
    """Get info about active waiters (for debugging/UI)."""
    return [
        {
            "id": w.id,
            "node_id": w.node_id,
            "node_type": w.node_type,
            "event_type": w.event_type,
            "done": w.future.done() if w.future else False,
            "cancelled": w.cancelled,
            "age_seconds": time.time() - w.created_at,
            "mode": "redis" if is_redis_mode() else "memory",
        }
        for w in _waiters.values()
    ]


def clear_all() -> int:
    """Clear all waiters (for testing/cleanup)."""
    count = len(_waiters)
    for w in _waiters.values():
        w.cancelled = True
        if w.future and not w.future.done():
            w.future.cancel()
    _waiters.clear()

    # Clear Redis waiter keys if in Redis mode
    if is_redis_mode():
        cache = get_cache_service()
        asyncio.create_task(cache.clear_pattern(f"{WAITERS_KEY_PREFIX}*"))

    return count


def get_backend_mode() -> str:
    """Get current backend mode for debugging."""
    return "redis" if is_redis_mode() else "memory"
