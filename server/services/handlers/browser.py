"""Browser automation handler — thin dispatcher to BrowserService.

Maps operation + parameters to CLI arguments, calls service, wraps response.
"""

import json
import time
from typing import Any, Dict

from services.browser_service import get_browser_service


async def handle_browser(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute a browser automation operation."""
    t0 = time.time()
    svc = get_browser_service()
    if not svc:
        return _fail("agent-browser not installed. Run: pnpm install && npx agent-browser install", t0)

    op = parameters.get("operation") or "navigate"
    session = (
        (parameters.get("session") or "").strip()
        or f"machina_{context.get('execution_id', 'default')}"
    )
    timeout = int(parameters.get("timeout") or 30)
    headed = bool(parameters.get("headed", True))
    user_agent = (parameters.get("userAgent") or "").strip() or None
    proxy = (parameters.get("proxy") or "").strip() or None
    action_delay = int(parameters.get("actionDelay") or 0)

    run_kw = dict(headed=headed, user_agent=user_agent, proxy=proxy)

    try:
        # Native pacing via agent-browser's wait command
        if action_delay > 0:
            await svc.run(["wait", str(action_delay)], session, timeout, **run_kw)

        if op == "batch":
            cmds = json.loads(parameters.get("commands", "[]"))
            data = await svc.run(
                ["batch", "--json"], session, timeout,
                stdin=json.dumps(cmds).encode(),
                **run_kw,
            )
        else:
            args = _build_args(op, parameters)
            data = await svc.run(args, session, timeout, **run_kw)

        return {
            "success": True,
            "result": {"operation": op, "data": data, "session": session},
            "execution_time": time.time() - t0,
        }
    except (ValueError, TimeoutError, RuntimeError) as e:
        return _fail(str(e), t0)


def _build_args(op: str, p: Dict[str, Any]) -> list:
    """Map an operation name + parameters to agent-browser CLI arguments."""
    s = (p.get("selector") or "").strip()
    match op:
        case "navigate":
            return ["open", _req(p, "url")]
        case "click":
            return ["click", _req_sel(s)]
        case "type":
            return ["type", _req_sel(s), p.get("text") or ""]
        case "fill":
            return ["fill", _req_sel(s), p.get("value") or ""]
        case "screenshot":
            return ["screenshot"] + (["--full"] if p.get("fullPage") else [])
        case "snapshot":
            return ["snapshot", "-i"]
        case "get_text":
            return ["get", "text", _req_sel(s)]
        case "get_html":
            return ["get", "html", _req_sel(s)]
        case "eval":
            return ["eval", _req(p, "expression")]
        case "wait":
            return ["wait", _req_sel(s)]
        case "scroll":
            return ["scroll", p.get("direction") or "down", str(p.get("amount") or 500)]
        case "select":
            return ["select", _req_sel(s), p.get("value") or ""]
        case _:
            raise ValueError(f"Unknown operation: {op}")


def _req(p: Dict[str, Any], key: str) -> str:
    v = (p.get(key) or "").strip()
    if not v:
        raise ValueError(f"{key} is required")
    return v


def _req_sel(s: str) -> str:
    if not s:
        raise ValueError("selector is required")
    return s


def _fail(error: str, t0: float) -> Dict[str, Any]:
    return {"success": False, "error": error, "execution_time": time.time() - t0}
