"""Filesystem and shell handlers - delegates to deepagents backends.

Uses deepagents.backends.LocalShellBackend methods:
  read() -> str, write() -> WriteResult, edit() -> EditResult,
  ls_info() -> list[FileInfo], glob_info() -> list[FileInfo],
  grep_raw() -> list[GrepMatch] | str, execute() -> ExecuteResponse.

All backend calls are synchronous (subprocess.run / file I/O), so they
run via asyncio.to_thread() to avoid blocking the event loop.
"""

import asyncio
import os
from typing import Any, Dict

from core.logging import get_logger

logger = get_logger(__name__)


def _get_backend(parameters: Dict[str, Any], context: Dict[str, Any] = None):
    """Get a LocalShellBackend rooted at per-workflow workspace."""
    from deepagents.backends import LocalShellBackend
    param_dir = parameters.get('working_directory')
    ctx_dir = context.get('workspace_dir') if context else None
    root = param_dir or ctx_dir or os.getcwd()
    logger.info("[Filesystem] root=%s (param=%s, context=%s, fallback_cwd=%s)",
                root, param_dir, ctx_dir, os.getcwd())
    return LocalShellBackend(root_dir=root, virtual_mode=True, inherit_env=True)


async def handle_file_read(
    node_id: str, node_type: str, parameters: Dict[str, Any], context: Dict[str, Any],
) -> Dict[str, Any]:
    """Read file via backend.read() which returns str content directly."""
    file_path = parameters.get('file_path', '')
    if not file_path:
        return {"success": False, "node_id": node_id, "error": "file_path is required"}

    try:
        backend = _get_backend(parameters, context)
        content = await asyncio.to_thread(backend.read, file_path, offset=int(parameters.get('offset', 0)), limit=int(parameters.get('limit', 100)))
        return {
            "success": True, "node_id": node_id,
            "result": {"content": content, "file_path": file_path},
        }
    except Exception as e:
        return {"success": False, "node_id": node_id, "error": str(e)}


async def handle_file_modify(
    node_id: str, node_type: str, parameters: Dict[str, Any], context: Dict[str, Any],
) -> Dict[str, Any]:
    """Write or edit file via backend.write()/edit()."""
    operation = parameters.get('operation', 'write')
    file_path = parameters.get('file_path', '')
    if not file_path:
        return {"success": False, "node_id": node_id, "error": "file_path is required"}

    try:
        backend = _get_backend(parameters, context)

        if operation == 'write':
            content = parameters.get('content', '')
            result = await asyncio.to_thread(backend.write, file_path, content)
            if result.error:
                return {"success": False, "node_id": node_id, "error": result.error}
            return {
                "success": True, "node_id": node_id,
                "result": {"operation": "write", "file_path": result.path or file_path},
            }

        elif operation == 'edit':
            old_string = parameters.get('old_string', '')
            new_string = parameters.get('new_string', '')
            replace_all = parameters.get('replace_all', False)
            if not old_string:
                return {"success": False, "node_id": node_id, "error": "old_string is required for edit"}

            result = await asyncio.to_thread(backend.edit, file_path, old_string, new_string, replace_all=replace_all)
            if result.error:
                return {"success": False, "node_id": node_id, "error": result.error}
            return {
                "success": True, "node_id": node_id,
                "result": {"operation": "edit", "file_path": result.path or file_path, "occurrences": result.occurrences},
            }

        return {"success": False, "node_id": node_id, "error": f"Unknown operation: {operation}"}
    except Exception as e:
        return {"success": False, "node_id": node_id, "error": str(e)}


async def handle_shell(
    node_id: str, node_type: str, parameters: Dict[str, Any], context: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute shell command via backend.execute()."""
    command = parameters.get('command', '')
    if not command:
        return {"success": False, "node_id": node_id, "error": "command is required"}

    try:
        timeout = int(parameters.get('timeout', 30))
        backend = _get_backend(parameters, context)
        logger.info("[Shell] Executing (non-blocking): %s (timeout=%ds)", command[:200], timeout)
        result = await asyncio.to_thread(backend.execute, command, timeout=timeout)
        if result.exit_code == 124:
            logger.warning("[Shell] Timed out after %ds: %s", timeout, command[:100])
        elif result.exit_code != 0:
            logger.warning("[Shell] Non-zero exit (%d): %s -> %s", result.exit_code, command[:100], result.output[:300])
        else:
            logger.info("[Shell] Completed: exit=%d len=%d", result.exit_code, len(result.output))
        return {
            "success": True, "node_id": node_id,
            "result": {
                "stdout": result.output,
                "exit_code": result.exit_code,
                "truncated": result.truncated,
                "command": command,
            },
        }
    except Exception as e:
        logger.error("[Shell] Failed: %s -> %s", command[:100], e)
        return {"success": False, "node_id": node_id, "error": str(e)}


async def handle_fs_search(
    node_id: str, node_type: str, parameters: Dict[str, Any], context: Dict[str, Any],
) -> Dict[str, Any]:
    """Search filesystem via backend.ls_info()/glob_info()/grep_raw()."""
    mode = parameters.get('mode', 'ls')
    path = parameters.get('path', '.')
    pattern = parameters.get('pattern', '')

    try:
        backend = _get_backend(parameters, context)

        if mode == 'ls':
            entries = await asyncio.to_thread(backend.ls_info, path)
            return {
                "success": True, "node_id": node_id,
                "result": {"path": path, "entries": [dict(e) for e in entries], "count": len(entries)},
            }

        elif mode == 'glob':
            if not pattern:
                return {"success": False, "node_id": node_id, "error": "pattern is required for glob mode"}
            matches = await asyncio.to_thread(backend.glob_info, pattern, path=path)
            return {
                "success": True, "node_id": node_id,
                "result": {"path": path, "pattern": pattern, "matches": [dict(m) for m in matches], "count": len(matches)},
            }

        elif mode == 'grep':
            if not pattern:
                return {"success": False, "node_id": node_id, "error": "pattern is required for grep mode"}
            file_filter = parameters.get('file_filter') or None
            result = await asyncio.to_thread(backend.grep_raw, pattern, path=path, glob=file_filter)
            # grep_raw returns list[GrepMatch] or str (error message)
            if isinstance(result, str):
                return {"success": False, "node_id": node_id, "error": result}
            return {
                "success": True, "node_id": node_id,
                "result": {"path": path, "pattern": pattern, "matches": [dict(m) for m in result], "count": len(result)},
            }

        return {"success": False, "node_id": node_id, "error": f"Unknown mode: {mode}"}
    except Exception as e:
        return {"success": False, "node_id": node_id, "error": str(e)}
