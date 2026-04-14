"""Unified node registration (Wave 10.C).

One decorator, one file per node. Each node's own module declares its
own metadata (displayName, icon, color, handles, componentKind, ...),
Pydantic input model, output model, and handler, and calls
``register_node(...)`` at import time. Discovery of ``server/nodes/*.py``
happens via ``server/nodes/__init__.py``'s ``pkgutil.walk_packages``.

Adding a new node = one Python module. Zero cross-cutting edits. Zero
frontend change. The NodeSpec envelope served at
``GET /api/schemas/nodes/{type}/spec.json`` picks up everything.

This is a **strangler fig** over the existing four registries:
    models/node_metadata.NODE_METADATA
    services/node_input_schemas._DIRECT_MODELS
    services/node_output_schemas.NODE_OUTPUT_SCHEMAS
    services/node_executor._build_handler_registry()

``register_node`` writes to the first three directly and to an
additional ``_HANDLER_REGISTRY`` dict that ``node_executor`` reads on
startup. Legacy entries that were seeded before ``register_node``
remain untouched — migration is incremental.
"""

from __future__ import annotations

from typing import Callable, Optional, Type

from pydantic import BaseModel

from models.node_metadata import NODE_METADATA, NodeMetadata
from services.node_input_schemas import _DIRECT_MODELS
from services.node_output_schemas import NODE_OUTPUT_SCHEMAS


_HANDLER_REGISTRY: dict[str, Callable] = {}


def register_node(
    *,
    type: str,
    metadata: NodeMetadata,
    input_model: Optional[Type[BaseModel]] = None,
    output_model: Optional[Type[BaseModel]] = None,
    handler: Optional[Callable] = None,
) -> None:
    """Register a node's metadata + schemas + handler in one call.

    Idempotent: re-registering the same type replaces the prior entry,
    which supports module hot-reload during development.

    Only ``type`` and ``metadata`` are required. A node can be handler-
    free (e.g. a memory / config node that only carries parameters the
    agent reads from the edge) or schema-free (e.g. a pure visual marker
    with no runtime effect), though in practice most nodes have both.
    """
    NODE_METADATA[type] = metadata
    if input_model is not None:
        _DIRECT_MODELS[type] = input_model
    if output_model is not None:
        NODE_OUTPUT_SCHEMAS[type] = output_model
    if handler is not None:
        _HANDLER_REGISTRY[type] = handler

    # Invalidate any NodeSpec cached under the same type — otherwise a
    # consumer that read the pre-registration (empty metadata) spec gets
    # stuck with stale fields. Re-registration is the whole point of
    # the strangler-fig migration, so caches must re-compute.
    from services.node_spec import _spec_cache  # local import to avoid cycle
    _spec_cache.pop(type, None)


def get_registered_handler(node_type: str) -> Optional[Callable]:
    """Handler registered via ``register_node``, or None.

    ``NodeExecutor._build_handler_registry`` consults this first and
    falls back to its built-in dict for types still on the legacy path.
    """
    return _HANDLER_REGISTRY.get(node_type)


def registered_node_types() -> frozenset[str]:
    """Types that came in via the plugin path. Useful for tests and for
    telling the legacy dispatcher which types it must NOT also claim."""
    return frozenset(_HANDLER_REGISTRY.keys())
