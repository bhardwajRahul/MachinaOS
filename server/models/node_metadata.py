"""Per-node display metadata.

Receives the UI-only fields (``displayName``, ``icon``, ``group``,
``subtitle``, ``description``) that today live in the frontend
``client/src/nodeDefinitions/*.ts`` files. Wave 6 Phase 3 migrates each
node-definition file's display metadata into this dict; until then
NodeSpec falls back to the node type id for missing entries.

Single source of truth for everything the parameter panel + palette
needs to render a node header. Kept as a plain dict (not Pydantic) for
fast iteration during the migration — switch to a TypedDict / Pydantic
model once the schema stabilises.
"""

from typing import Any, Literal, Optional, TypedDict


class NodeHandle(TypedDict, total=False):
    """One React Flow handle on a node. Wave 10.A replaces the
    frontend-hardcoded `AGENT_CONFIGS` handle topology.
    """

    name: str                                            # "input-skill", "output-top", ...
    kind: Literal["input", "output"]
    position: Literal["top", "bottom", "left", "right"]
    offset: str                                          # CSS % e.g. "25%"; optional
    label: str                                           # tooltip
    role: str                                            # "main" / "skill" / "tools" / "memory" / "task" / "teammates" / "model"


class NodeMetadata(TypedDict, total=False):
    # Existing (Wave 6):
    displayName: str
    icon: str                                            # emoji | "asset:<key>" | SVG data URI
    group: list[str]
    subtitle: str
    description: str
    version: int
    # Per-node UI panel hints lifted from the legacy frontend INodeUIHints.
    # Flags like isChatTrigger / isConsoleSink / hasCodeEditor / isMemoryPanel.
    uiHints: dict[str, object]

    # Wave 10.A — full visual contract:
    color: str                                           # hex or dracula token e.g. "#bd93f9"
    componentKind: Literal[                              # frontend component dispatch key
        "square", "circle", "trigger", "start",
        "agent", "chat", "tool", "model", "generic",
    ]
    handles: list[NodeHandle]                            # replaces AGENT_CONFIGS topology
    credentials: list[str]                               # provider keys
    hideOutputHandle: bool                               # replaces NO_OUTPUT_NODE_TYPES
    visibility: Literal["all", "normal", "dev"]          # replaces SIMPLE_MODE_CATEGORIES


# Seeded incrementally per Wave 6 Phase 3 sub-commit. Sub-commit 3a
# covers utility + code + process + workflow groups (12 types). Later
# sub-commits add messaging (3b), agents/models (3c), and the rest.
# Source: client/src/nodeDefinitions/*.ts at the time of migration.
# Plugin-populated registry. Each node module in server/nodes/*.py
# calls services.node_registry.register_node(...) at import time to
# add its own entry here. server/nodes/__init__.py walks the package
# on startup (see main.py lifespan) so this dict is fully populated
# before any NodeSpec endpoint serves a request. No hardcoded data.
NODE_METADATA: dict[str, NodeMetadata] = {}


def get_node_metadata(node_type: str) -> Optional[NodeMetadata]:
    """Return display metadata for a node type, or None if not seeded."""

    return NODE_METADATA.get(node_type)


def fallback_metadata(node_type: str) -> NodeMetadata:
    """Minimal metadata for a node type without a seeded entry. Keeps
    NodeSpec emission valid even before Phase 3 migrations land."""

    return {
        "displayName": node_type,
        "icon": "",
        "group": [],
        "description": "",
        "version": 1,
    }
