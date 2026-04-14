"""Declarative credential types (Wave 11.E).

One file per provider. Each module declares a :class:`Credential`
subclass (or several, for OAuth + API-key fallback). Auto-discovery
via :func:`_discover` at import time, same mechanism as
``server/nodes/__init__.py``. Plugin nodes reference these classes in
their ``credentials = (...)`` tuple — no string lookups, no registry
writes from plugin code.

This package is populated incrementally as plugins are migrated in
11.B/11.C. Existing nodes on the legacy handler path continue calling
``auth_service.get_api_key(...)`` directly; the shift is opt-in.
"""

from __future__ import annotations

import importlib
import pkgutil
from typing import List

from core.logging import get_logger

logger = get_logger(__name__)


def _discover() -> List[str]:
    imported: List[str] = []
    for module_info in pkgutil.iter_modules(__path__):
        name = module_info.name
        if name.startswith("_"):
            continue
        full_name = f"{__name__}.{name}"
        try:
            importlib.import_module(full_name)
            imported.append(name)
        except Exception:
            logger.exception("Failed to import credential module %s", full_name)
    return imported


_DISCOVERED = _discover()
