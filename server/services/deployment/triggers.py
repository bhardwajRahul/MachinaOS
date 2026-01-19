"""Trigger Management - Setup and teardown of workflow triggers.

Handles cron scheduling, event-based triggers (webhook, whatsapp), and cleanup.
"""

import asyncio
from datetime import datetime
from typing import Dict, Any, Callable, Optional, Set

from core.logging import get_logger
from constants import WORKFLOW_TRIGGER_TYPES
from services import event_waiter
from services import scheduler as cron_scheduler

logger = get_logger(__name__)


class TriggerManager:
    """Manages workflow trigger lifecycle."""

    def __init__(self, main_loop: Optional[asyncio.AbstractEventLoop] = None):
        self._active_cron_jobs: Dict[str, str] = {}  # node_id -> job_id
        self._active_listeners: Dict[str, asyncio.Task] = {}  # node_id -> task
        self._main_loop = main_loop
        self._is_running = False

    def set_running(self, running: bool):
        self._is_running = running

    def set_main_loop(self, loop: asyncio.AbstractEventLoop):
        self._main_loop = loop

    # =========================================================================
    # CRON TRIGGERS
    # =========================================================================

    def setup_cron(self, node_id: str, cron_expr: str, timezone: str,
                   on_tick: Callable[[], None]) -> str:
        """Setup a cron trigger that calls on_tick on schedule."""
        job_id = f"cron_{node_id}"

        def tick_callback():
            if not self._is_running:
                return
            on_tick()

        cron_scheduler.register_cron_job(
            job_id=job_id,
            cron_expression=cron_expr,
            callback=tick_callback,
            timezone=timezone
        )

        self._active_cron_jobs[node_id] = job_id
        logger.info("Cron trigger setup", job_id=job_id, expr=cron_expr)
        return job_id

    def teardown_cron(self, node_id: str) -> bool:
        """Remove a specific cron trigger."""
        job_id = self._active_cron_jobs.pop(node_id, None)
        if job_id:
            cron_scheduler.remove_cron_job(job_id)
            logger.debug("Cron trigger removed", job_id=job_id)
            return True
        return False

    def get_cron_node_ids(self) -> list:
        """Get node IDs of active cron triggers."""
        return list(self._active_cron_jobs.keys())

    def teardown_all_crons(self) -> int:
        """Remove all cron triggers."""
        count = 0
        for node_id, job_id in list(self._active_cron_jobs.items()):
            cron_scheduler.remove_cron_job(job_id)
            count += 1
        self._active_cron_jobs.clear()
        logger.info("All cron triggers removed", count=count)
        return count

    # =========================================================================
    # EVENT TRIGGERS (Webhook, WhatsApp, etc.)
    # =========================================================================

    async def setup_event_trigger(self, node_id: str, node_type: str,
                                   parameters: Dict[str, Any],
                                   on_event: Callable[[Dict], Any],
                                   broadcaster: Any,
                                   workflow_id: Optional[str] = None) -> None:
        """Setup an event-based trigger with queue-based sequential processing.

        Args:
            node_id: The trigger node ID
            node_type: Type of trigger (whatsappReceive, webhookTrigger, etc.)
            parameters: Node parameters for filtering
            on_event: Callback when event is received
            broadcaster: Status broadcaster for real-time updates
            workflow_id: Workflow ID for scoped status updates (n8n pattern)
        """
        event_queue: asyncio.Queue = asyncio.Queue()
        is_executing = False

        async def collector():
            """Continuously collect events into queue."""
            while self._is_running:
                try:
                    waiter = await event_waiter.register(node_type, node_id, parameters)
                    config = event_waiter.get_trigger_config(node_type)

                    if config and not is_executing:
                        queue_size = event_queue.qsize()
                        msg = f"Waiting for {config.display_name}..."
                        if queue_size > 0:
                            msg = f"Waiting... ({queue_size} queued)"
                        await broadcaster.update_node_status(node_id, "waiting", {
                            "message": msg,
                            "event_type": config.event_type,
                            "waiter_id": waiter.id,
                            "queue_size": queue_size
                        }, workflow_id=workflow_id)

                    event_data = await event_waiter.wait_for_event(waiter)
                    if self._is_running:
                        await event_queue.put(event_data)

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error("Trigger collector error", node_id=node_id, error=str(e))
                    if self._is_running:
                        await asyncio.sleep(1)

        async def processor():
            """Process events from queue sequentially."""
            nonlocal is_executing
            while self._is_running:
                try:
                    try:
                        event_data = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                    except asyncio.TimeoutError:
                        continue

                    is_executing = True
                    config = event_waiter.get_trigger_config(node_type)

                    # Clear waiting indicator during execution
                    await broadcaster.update_node_status(node_id, "idle", {
                        "message": "Graph executing...",
                        "is_processing": True
                    }, workflow_id=workflow_id)

                    try:
                        await on_event(event_data)
                    except Exception as e:
                        logger.error("Trigger execution error", node_id=node_id, error=str(e))

                    is_executing = False

                    # Return to waiting state
                    queue_size = event_queue.qsize()
                    name = config.display_name if config else node_type
                    msg = f"Waiting for {name}..." if queue_size == 0 else f"Processing next... ({queue_size} queued)"
                    await broadcaster.update_node_status(node_id, "waiting", {
                        "message": msg,
                        "queue_size": queue_size,
                        "is_processing": False
                    }, workflow_id=workflow_id)

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error("Trigger processor error", node_id=node_id, error=str(e))
                    is_executing = False

        async def combined():
            collector_task = asyncio.create_task(collector())
            processor_task = asyncio.create_task(processor())
            try:
                await asyncio.gather(collector_task, processor_task)
            except asyncio.CancelledError:
                collector_task.cancel()
                processor_task.cancel()
                await asyncio.gather(collector_task, processor_task, return_exceptions=True)

        task = asyncio.create_task(combined())
        self._active_listeners[node_id] = task

    async def teardown_all_listeners(self) -> int:
        """Cancel all event listeners."""
        count = 0
        for node_id, task in list(self._active_listeners.items()):
            if not task.done():
                task.cancel()
                count += 1

        if self._active_listeners:
            await asyncio.gather(*self._active_listeners.values(), return_exceptions=True)

        self._active_listeners.clear()
        return count

    def get_listener_node_ids(self) -> list:
        """Get node IDs of active listeners."""
        return list(self._active_listeners.keys())

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    @staticmethod
    def build_cron_expression(parameters: Dict[str, Any]) -> Optional[str]:
        """Build cron expression from user-friendly parameters."""
        frequency = parameters.get('frequency', 'minutes')

        second, minute, hour = '0', '*/5', '*'
        day, month, weekday = '*', '*', '*'

        if frequency == 'seconds':
            interval = str(parameters.get('interval', 30))
            second, minute = f'*/{interval}', '*'

        elif frequency == 'minutes':
            interval = str(parameters.get('intervalMinutes', 5))
            minute = f'*/{interval}' if interval != '1' else '*'

        elif frequency == 'hours':
            interval = str(parameters.get('intervalHours', 1))
            minute = '0'
            hour = f'*/{interval}' if interval != '1' else '*'

        elif frequency == 'days':
            time_str = parameters.get('dailyTime', '09:00')
            parts = time_str.split(':')
            hour = parts[0] if parts else '9'
            minute = parts[1] if len(parts) > 1 else '0'

        elif frequency == 'weeks':
            time_str = parameters.get('weeklyTime', '09:00')
            parts = time_str.split(':')
            hour = parts[0] if parts else '9'
            minute = parts[1] if len(parts) > 1 else '0'
            weekday = parameters.get('weekday', '1')

        elif frequency == 'months':
            time_str = parameters.get('monthlyTime', '09:00')
            parts = time_str.split(':')
            hour = parts[0] if parts else '9'
            minute = parts[1] if len(parts) > 1 else '0'
            day = parameters.get('monthDay', '1')

        elif frequency == 'once':
            return None

        return f'{second} {minute} {hour} {day} {month} {weekday}'

    @staticmethod
    def find_trigger_nodes(nodes: list, edges: list) -> tuple:
        """Find trigger nodes, split into start nodes and event triggers."""
        # Nodes with incoming edges
        nodes_with_inputs = {e.get('target') for e in edges if e.get('target')}

        trigger_types_no_cron = WORKFLOW_TRIGGER_TYPES - {'cronScheduler'}
        triggers = [n for n in nodes
                   if n.get('type') in trigger_types_no_cron
                   and n.get('id') not in nodes_with_inputs]

        start_nodes = [n for n in triggers if n.get('type') == 'start']
        event_triggers = [n for n in triggers if n.get('type') != 'start']

        return start_nodes, event_triggers

    @staticmethod
    def find_cron_nodes(nodes: list) -> list:
        """Find all cron scheduler nodes."""
        return [n for n in nodes if n.get('type') == 'cronScheduler']
