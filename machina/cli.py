"""Typer CLI for ``machina``.

Each subcommand lives under ``machina.commands``; this module just
mounts them and exposes ``app`` as the entry point.
"""

from __future__ import annotations

import typer

from machina.commands.stop import stop_command


app = typer.Typer(
    name="machina",
    help="MachinaOS project supervisor CLI.",
    no_args_is_help=True,
    add_completion=False,
)


@app.callback()
def _root() -> None:
    """Marks the Typer app as a multi-command group.

    Without an ``@app.callback()`` Typer collapses a single registered
    subcommand into the root, hiding the subcommand structure that's
    about to grow as more JS scripts migrate.
    """


app.command("stop", help="Stop all MachinaOS services and free configured ports.")(
    stop_command
)


if __name__ == "__main__":
    app()
