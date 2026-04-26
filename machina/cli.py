"""Typer CLI for ``machina``.

Each subcommand lives under ``machina.commands``; this module just
mounts them and exposes ``app`` as the entry point.
"""

from __future__ import annotations

import typer

from machina.commands.build import build_command
from machina.commands.clean import clean_command
from machina.commands.stop import stop_command


app = typer.Typer(
    name="machina",
    help="MachinaOS project supervisor CLI.",
    no_args_is_help=True,
    add_completion=False,
)


@app.callback()
def _root() -> None:
    """Marks the Typer app as a multi-command group."""


app.command("stop", help="Stop all MachinaOS services and free configured ports.")(
    stop_command
)
app.command("clean", help="Stop services then remove build artefacts and venvs.")(
    clean_command
)
app.command("build", help="Install toolchain + build client + sync Python + verify deps.")(
    build_command
)


if __name__ == "__main__":
    app()
