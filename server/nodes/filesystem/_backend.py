"""Shared deepagents-backend helper for filesystem plugins.

All four filesystem plugins (file_read / file_modify / shell /
fs_search) open a :class:`deepagents.backends.LocalShellBackend`
rooted at the per-workflow workspace. This helper centralises that
setup so each plugin file stays small.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional


def get_backend(
    parameters: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
):
    """Return a LocalShellBackend rooted at the per-workflow workspace.

    Resolution order: explicit ``working_directory`` param >
    ``context.workspace_dir`` > ``Settings().workspace_base_resolved/default``.
    The directory is created if it doesn't exist. ``virtual_mode=True``
    sandboxes paths inside the root.
    """
    from core.config import Settings
    from core.logging import get_logger
    from deepagents.backends import LocalShellBackend

    param_dir = parameters.get("working_directory")
    ctx_dir = context.get("workspace_dir") if context else None
    root = (
        param_dir
        or ctx_dir
        or os.path.join(Settings().workspace_base_resolved, "default")
    )
    os.makedirs(root, exist_ok=True)
    get_logger(__name__).info("[Filesystem] root=%s", root)
    return LocalShellBackend(root_dir=root, virtual_mode=True)
