"""Unified NodeSpec assembly.

A NodeSpec is the wire contract between the editor and the backend's
node registry — everything the editor needs to render a node into the
canvas, palette, and parameter panel:

    {
      "type": "...",
      "displayName": "...",
      "icon": "...",
      "group": ["..."],
      "version": 1,
      "inputs": <JSON Schema 7>,    # input parameter schema (Wave 6 Phase 1)
      "outputs": <JSON Schema 7>,   # runtime output shape (Wave 3)
      "credentials": ["..."],       # provider keys, derived from handler
      "uiHints": {...},             # opt-in panel/widget hints
    }

This module is the single point that fuses the three sources of truth:
    services/node_input_schemas.NODE_INPUT_MODELS
    services/node_output_schemas.NODE_OUTPUT_SCHEMAS
    models/node_metadata.NODE_METADATA

Wave 6 Phase 1 — see C:\\Users\\Tgroh\\.claude\\plans\\typed-splashing-crown.md.
"""

from typing import Any, Optional

from models.node_metadata import fallback_metadata, get_node_metadata
from services.node_input_schemas import (
    NODE_INPUT_MODELS,
    get_node_input_schema,
)
from services.node_output_schemas import (
    NODE_OUTPUT_SCHEMAS,
    get_node_output_schema,
)


_spec_cache: dict[str, dict[str, Any]] = {}


def get_node_spec(node_type: str) -> Optional[dict[str, Any]]:
    """Return the full NodeSpec for a node type, or None if neither an
    input model, an output schema, nor plugin metadata is registered
    (i.e. unknown type). Cached per-process; bust by restarting the
    server.

    Wave 10.G.3: metadata-only plugin nodes (e.g. calculatorTool and
    the other schema-less tool nodes) emit a spec even without input
    schema — their NodeSpec carries componentKind + handles + color,
    which is everything the editor needs to render and connect them.
    """

    if node_type in _spec_cache:
        return _spec_cache[node_type]

    inputs = get_node_input_schema(node_type)
    outputs = get_node_output_schema(node_type)
    meta = get_node_metadata(node_type)
    if inputs is None and outputs is None and meta is None:
        return None
    if meta is None:
        meta = fallback_metadata(node_type)
    spec: dict[str, Any] = {
        "type": node_type,
        "displayName": meta.get("displayName") or node_type,
        "icon": meta.get("icon", ""),
        "group": meta.get("group", []),
        "description": meta.get("description", ""),
        "version": meta.get("version", 1),
    }
    if inputs is not None:
        spec["inputs"] = inputs
    if outputs is not None:
        spec["outputs"] = outputs
    if "subtitle" in meta:
        spec["subtitle"] = meta["subtitle"]
    if meta.get("uiHints"):
        spec["uiHints"] = meta["uiHints"]

    # Wave 10.A — full visual contract. Only emit fields when seeded so the
    # wire format stays compact and unseeded types keep the pre-10 shape.
    for key in ("color", "componentKind", "handles", "credentials",
                "hideOutputHandle", "visibility"):
        if key in meta:
            spec[key] = meta[key]

    _spec_cache[node_type] = spec
    return spec


def list_node_types_with_spec() -> list[str]:
    """Stable sorted list of every node type that has at least an input
    model or an output schema. Editor uses this on boot to know which
    types it can probe without 404s."""

    return sorted(set(NODE_INPUT_MODELS.keys()) | set(NODE_OUTPUT_SCHEMAS.keys()))


def list_node_groups() -> dict[str, list[str]]:
    """Wave 6 Phase 5: invert the per-spec ``group`` arrays into a
    {group_name: [node_type, ...]} index. Replaces the 34 hand-rolled
    ``*_NODE_TYPES`` arrays scattered across the frontend.

    Editor consumers (`useNodeGroup('tool')`, palette filters, console
    sink detection, etc.) read from a single TanStack Query backed by
    this endpoint instead of importing per-category constants.
    """

    index: dict[str, set[str]] = {}
    for node_type in list_node_types_with_spec():
        spec = get_node_spec(node_type)
        if not spec:
            continue
        for group in spec.get("group", []):
            index.setdefault(group, set()).add(node_type)
    return {group: sorted(types) for group, types in sorted(index.items())}
