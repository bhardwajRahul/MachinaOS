"""Central handler for node visuals (icon + color).

Every node plugin's icon and color live in ``visuals.json`` next to
this module. The base ``BaseNode`` class consults
:func:`get_icon` / :func:`get_color` at registration time when a
subclass doesn't set the class attribute itself.

Single source of truth — change the icon for ``aiAgent`` here once
and every consumer (palette, parameter panel, canvas) picks it up
the next time the backend NodeSpec cache rehydrates.

Adding a new node: add an entry to ``visuals.json`` (or rely on the
empty default — the icon resolver falls back to the empty string,
which the frontend renders as a placeholder). Node files do NOT
declare ``icon`` or ``color`` themselves.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict


_VISUALS_PATH = Path(__file__).resolve().parent / "visuals.json"


def _load() -> Dict[str, Dict[str, str]]:
    if not _VISUALS_PATH.exists():
        return {}
    with _VISUALS_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        return {}
    return data


# Loaded once at import; the JSON is small (<5 KB) and editing it
# requires a backend restart to refresh, same as any other node-spec
# metadata change.
_VISUALS: Dict[str, Dict[str, str]] = _load()


def get_icon(node_type: str) -> str:
    """Return the registered icon for ``node_type`` or empty string.

    Icon strings follow the same wire format the frontend's
    ``resolveIcon`` understands: emoji, ``asset:<key>``, or
    ``lobehub:<brand>``.
    """
    entry = _VISUALS.get(node_type)
    if not entry:
        return ""
    return str(entry.get("icon", ""))


def get_color(node_type: str) -> str:
    """Return the registered color for ``node_type`` or empty string.

    Color strings are arbitrary CSS color literals — the canvas node
    components apply them as-is to gradients, borders, and badges.
    """
    entry = _VISUALS.get(node_type)
    if not entry:
        return ""
    return str(entry.get("color", ""))


def get_skill(node_type: str) -> str:
    """Return the teaching skill folder name registered for ``node_type``.

    Many tool / utility nodes have a paired skill in ``server/skills/``
    that documents how an AI agent should use them. The ``skill`` field
    in ``visuals.json`` is the reverse lookup consumed by
    ``services.auto_skill`` to decide what to do when a tool node is
    connected to an AI agent.
    """
    entry = _VISUALS.get(node_type)
    if not entry:
        return ""
    return str(entry.get("skill", ""))
