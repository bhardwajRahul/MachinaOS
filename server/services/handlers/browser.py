"""Browser automation handler — thin dispatcher to BrowserService.

Maps operation + parameters to CLI arguments, calls service, wraps response.
"""

import json
import shutil
import sys
import time
from typing import Any, Dict, Optional

from core.logging import get_logger
from services.browser_service import get_browser_service

logger = get_logger(__name__)


# PATH-based names for shutil.which() (Linux/macOS/Windows where on PATH).
_BROWSER_PATH_NAMES = {
    "chrome": ["google-chrome", "google-chrome-stable", "chrome"],
    "edge": ["microsoft-edge", "microsoft-edge-stable", "msedge"],
    "chromium": ["chromium", "chromium-browser"],
}

# Windows registry App Paths keys (how Selenium/Playwright find browsers).
_BROWSER_REGISTRY_KEYS = {
    "chrome": "chrome.exe",
    "edge": "msedge.exe",
    "chromium": "chrome.exe",
}


def _find_browser_via_registry(exe_name: str) -> Optional[str]:
    """Find a browser executable via the Windows App Paths registry.

    This is the standard method used by Selenium and Playwright.
    HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\<exe>
    """
    try:
        import winreg
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            try:
                key = winreg.OpenKey(
                    hive,
                    rf"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{exe_name}",
                )
                path, _ = winreg.QueryValueEx(key, "")
                winreg.CloseKey(key)
                if path:
                    return path
            except OSError:
                continue
    except ImportError:
        pass
    return None


def _resolve_browser(selection: str, custom_path: str) -> Optional[str]:
    """Resolve a browser dropdown selection to an executable path.

    Tries shutil.which (PATH) first, then Windows registry App Paths.
    Returns None for 'bundled' (let agent-browser use its own Chrome).
    """
    if selection in ("bundled", "bundled_explicit") or not selection:
        return None
    if selection == "custom":
        return custom_path or None

    # Try PATH first (works on Linux/macOS where browsers are on PATH)
    for name in _BROWSER_PATH_NAMES.get(selection, []):
        path = shutil.which(name)
        if path:
            return path

    # On Windows, query the registry (standard App Paths lookup)
    if sys.platform == "win32":
        reg_name = _BROWSER_REGISTRY_KEYS.get(selection)
        if reg_name:
            path = _find_browser_via_registry(reg_name)
            if path:
                return path

    return None


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
    auto_connect = bool(parameters.get("autoConnect", False))
    browser_sel = parameters.get("browser", "chrome")
    # "bundled" was the old default before system Chrome became default.
    # Upgrade it to "chrome". Users who explicitly want bundled pick "bundled_explicit".
    if not browser_sel or browser_sel == "bundled":
        browser_sel = "chrome"
    custom_path = (parameters.get("executablePath") or "").strip()
    executable_path = _resolve_browser(browser_sel, custom_path)
    logger.info("[Browser] browser=%s executable=%s", browser_sel, executable_path)
    new_window = bool(parameters.get("newWindow", True)) and executable_path is not None
    chrome_profile = (parameters.get("chromeProfile") or "").strip() or None
    user_agent = (parameters.get("userAgent") or "").strip() or None
    proxy = (parameters.get("proxy") or "").strip() or None
    action_delay = int(parameters.get("actionDelay") or 0)

    run_kw = dict(
        headed=headed, user_agent=user_agent, proxy=proxy,
        executable_path=executable_path, auto_connect=auto_connect,
        chrome_profile=chrome_profile, new_window=new_window,
    )

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
        case "console":
            return ["console"]
        case "errors":
            return ["errors"]
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
