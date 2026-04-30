"""Shared deepagents-backend helper for filesystem plugins.

All four filesystem plugins (file_read / file_modify / shell /
fs_search) open a :class:`deepagents.backends.LocalShellBackend`
rooted at the per-workflow workspace. This helper centralises that
setup so each plugin file stays small.
"""

from __future__ import annotations

import os
from pathlib import PureWindowsPath
from typing import Any, Dict, Optional

from deepagents.backends.utils import validate_path


def normalize_virtual_path(path: str) -> str:
    """Coerce any caller-supplied path to deepagents' canonical virtual form.

    LLMs (and humans) emit paths in every flavour: ``/foo`` (POSIX),
    ``C:\\foo`` (Windows drive), ``\\\\server\\share\\foo`` (UNC),
    ``foo\\bar`` / ``foo/bar`` (relative, mixed separators). deepagents'
    ``virtual_mode`` only resolves POSIX virtual paths, and its public
    :func:`validate_path` helper rejects Windows-anchored inputs.

    ``PureWindowsPath`` is a pure (host-OS independent) parser and is a
    superset of the POSIX grammar — Windows itself accepts ``/`` as a
    separator, so ``PureWindowsPath('/tmp/foo')`` correctly identifies
    ``/`` as the root anchor. That means a single parser covers Windows
    drives, UNC, and POSIX absolutes uniformly on any host OS. Strip
    the anchor here, then delegate to :func:`validate_path` for traversal
    rejection (``..``, ``~``) and canonical normalisation.
    """
    if not path:
        return path
    pw = PureWindowsPath(path)
    if pw.drive or pw.root:
        rel = "/" + "/".join(pw.parts[1:]) if len(pw.parts) > 1 else "/"
    else:
        rel = path.replace("\\", "/")
    return validate_path(rel)


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
