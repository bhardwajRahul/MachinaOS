"""Plugins for the 'whatsapp' palette group.

Public surface:
    WhatsAppRuntime          - edgymeow Go binary supervisor
    get_whatsapp_runtime()   - singleton accessor (lazy-init via classmethod)

The runtime self-registers with ``services._supervisor.registry`` on
package import, so ``services._supervisor.shutdown_all_supervisors()``
called from the FastAPI lifespan will tear it down with all other
plugin supervisors. No per-plugin lifespan hooks needed.
"""

from services._supervisor import register_supervisor

from ._runtime import WhatsAppRuntime, get_whatsapp_runtime

# Self-registration: ensures shutdown_all_supervisors() reaches us.
# get_instance() constructs the singleton once (lazy in spawn, not here).
register_supervisor(WhatsAppRuntime.get_instance())

__all__ = [
    "WhatsAppRuntime",
    "get_whatsapp_runtime",
]
