"""Browser — Wave 11.E.3 inlined.

Interactive browser automation via the agent-browser CLI. The plugin
maps the high-level operation enum to CLI argv, resolves the browser
binary (system Chrome / Edge / Chromium / bundled), and delegates the
subprocess invocation to ``services.browser_service``.
"""

from __future__ import annotations

import json
import shutil
import sys
import time
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.logging import get_logger
from services.plugin import ActionNode, NodeContext, Operation, TaskQueue

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

    HKLM/HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\<exe>
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
    """Resolve a browser dropdown selection to an executable path."""
    if selection in ("bundled", "bundled_explicit") or not selection:
        return None
    if selection == "custom":
        return custom_path or None

    for name in _BROWSER_PATH_NAMES.get(selection, []):
        path = shutil.which(name)
        if path:
            return path

    if sys.platform == "win32":
        reg_name = _BROWSER_REGISTRY_KEYS.get(selection)
        if reg_name:
            path = _find_browser_via_registry(reg_name)
            if path:
                return path
    return None


def _req(p: Dict[str, Any], key: str) -> str:
    v = (p.get(key) or "").strip()
    if not v:
        raise ValueError(f"{key} is required")
    return v


def _req_sel(s: str) -> str:
    if not s:
        raise ValueError("selector is required")
    return s


def _build_args(op: str, p: Dict[str, Any]) -> List[str]:
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
            args = ["screenshot"]
            if p.get("fullPage"):
                args.append("--full")
            if p.get("annotate"):
                args.append("--annotate")
            fmt = p.get("screenshotFormat", "png")
            if fmt and fmt != "png":
                args.extend(["--screenshot-format", fmt])
                quality = p.get("screenshotQuality")
                if quality and fmt == "jpeg":
                    args.extend(["--screenshot-quality", str(quality)])
            return args
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


class BrowserParams(BaseModel):
    operation: Literal[
        "navigate", "click", "type", "fill", "screenshot", "snapshot",
        "get_text", "get_html", "eval", "wait", "scroll", "select", "batch",
    ] = "navigate"
    url: str = Field(default="")
    selector: str = Field(default="")
    text: str = Field(default="")
    session: str = Field(default="")

    model_config = ConfigDict(extra="allow")


class BrowserOutput(BaseModel):
    operation: Optional[str] = None
    data: Optional[Any] = None
    session: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class BrowserNode(ActionNode):
    type = "browser"
    display_name = "Browser"
    subtitle = "Browser Automation"
    icon = "asset:chrome"
    color = "#ff79c6"
    group = ("browser", "tool")
    description = "Interactive browser automation via agent-browser CLI"
    component_kind = "square"
    handles = (
        {"name": "input-main", "kind": "input", "position": "left", "label": "Input", "role": "main"},
        {"name": "output-main", "kind": "output", "position": "right", "label": "Output", "role": "main"},
    )
    annotations = {"destructive": True, "readonly": False, "open_world": True}
    task_queue = TaskQueue.BROWSER
    usable_as_tool = True

    Params = BrowserParams
    Output = BrowserOutput

    @Operation("dispatch")
    async def dispatch(self, ctx: NodeContext, params: BrowserParams) -> BrowserOutput:
        from services.browser_service import get_browser_service

        svc = get_browser_service()
        if not svc:
            raise RuntimeError(
                "agent-browser not installed. Run: pnpm install && npx agent-browser install",
            )

        p = params.model_dump(by_alias=True)
        op = p.get("operation") or "navigate"
        session = (
            (p.get("session") or "").strip()
            or f"machina_{ctx.raw.get('execution_id', 'default')}"
        )
        timeout = int(p.get("timeout") or 30)
        headed = bool(p.get("headed", True))
        auto_connect = bool(p.get("autoConnect", False))
        browser_sel = p.get("browser", "chrome")
        if not browser_sel or browser_sel == "bundled":
            browser_sel = "chrome"
        custom_path = (p.get("executablePath") or "").strip()
        executable_path = _resolve_browser(browser_sel, custom_path)
        logger.info("[Browser] browser=%s executable=%s", browser_sel, executable_path)
        new_window = bool(p.get("newWindow", True)) and executable_path is not None
        chrome_profile = (p.get("chromeProfile") or "").strip() or None
        user_agent = (p.get("userAgent") or "").strip() or None
        proxy = (p.get("proxy") or "").strip() or None
        action_delay = int(p.get("actionDelay") or 0)

        run_kw = dict(
            headed=headed, user_agent=user_agent, proxy=proxy,
            executable_path=executable_path, auto_connect=auto_connect,
            chrome_profile=chrome_profile, new_window=new_window,
        )

        if action_delay > 0:
            await svc.run(["wait", str(action_delay)], session, timeout, **run_kw)

        if op == "batch":
            cmds = json.loads(p.get("commands", "[]"))
            data = await svc.run(
                ["batch", "--json"], session, timeout,
                stdin=json.dumps(cmds).encode(),
                **run_kw,
            )
        else:
            data = await svc.run(_build_args(op, p), session, timeout, **run_kw)

        return BrowserOutput(operation=op, data=data, session=session)
