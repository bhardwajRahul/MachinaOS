"""Rich console + per-service color rotation (Honcho-style)."""

from __future__ import annotations

from itertools import cycle
from rich.console import Console


# Single shared console — single-writer aggregator avoids interleaving
# concurrent stream output (VS Code's pty host pattern).
console = Console()


# Honcho's rotation, lifted: skip very-dark (black) and very-bright (white)
# so prefixes remain readable on both light and dark terminals.
_PALETTE = [
    "cyan", "green", "yellow", "blue", "magenta",
    "bright_cyan", "bright_green", "bright_yellow", "bright_blue", "bright_magenta",
]
_color_cycle = cycle(_PALETTE)


def next_color() -> str:
    return next(_color_cycle)


def emit(name: str, color: str, line: str, *, stream: str = "stdout") -> None:
    """Print one line tagged with the service name + color.

    Renders as ``cyan          │ <message>`` so prefix width is uniform
    across services.
    """
    width = 12
    prefix = f"[{color}]{name:<{width}}[/{color}]"
    style = "" if stream == "stdout" else "[dim]"
    suffix = "" if stream == "stdout" else "[/dim]"
    console.print(f"{prefix}{style} | {line}{suffix}", highlight=False)
