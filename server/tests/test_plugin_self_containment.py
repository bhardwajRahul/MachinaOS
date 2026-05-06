"""Plugin self-containment invariants (Wave 11.H plan, milestone H).

Seven invariant classes lock the contract that every migrated plugin
owns its full surface (handlers, router, service code) under
``server/nodes/<plugin>/`` and that nothing outside that folder
imports plugin internals by name.

Renaming a plugin file or moving plugin code back into ``services/``
or ``routers/`` will trip exactly one of these tests, the same
enforcement style as ``test_credential_broadcasts.py``.

Coverage map
------------
1. ``TestRoutersWebsocketHasNoPluginImports`` -- the central WS dispatch
   table imports zero plugin internals. Forbidden-fragment list.
2. ``TestNoPluginRouterOutsideNodes`` -- migrated plugins' FastAPI
   routers do not exist under ``server/routers/``. File-existence check.
3. ``TestPluginInitSelfRegisters`` -- every plugin folder with a
   ``_handlers.py`` or ``_router.py`` self-registers from its
   ``__init__.py``. Parametrized over the 9 migrated plugins.
4. ``TestRegistryLookupsExist`` -- registry public API sanity.
5. ``TestStaleServiceFilesAbsent`` -- the 11 migrated old service
   paths must not be re-introduced. File-existence check.
6. ``TestMainPyDoesNotMountPluginRouters`` -- ``main.py`` does not
   wire plugin routers explicitly; they flow in via the plugin loop.
7. ``TestPluginHandlersDictsArePopulated`` -- when a plugin ships
   ``_handlers.py``, its registered surface is non-empty.
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

import routers.websocket as ws_module
from services import ws_handler_registry


# Plugins migrated through Wave 11.H (commits A through F):
#   B = whatsapp     (commit 72b4ae7)
#   C = twitter      (commit 7ed846b)
#   D = google       (commit 1392cbb)
#   E = android      (commit 8306f47)
#   F = browser, email, code (commit 44e579e)
# telegram and stripe are the pre-Wave-11.H references.
_MIGRATED_PLUGINS = (
    "android",
    "browser",
    "code",
    "email",
    "google",
    "stripe",
    "telegram",
    "twitter",
    "whatsapp",
)

# Forbidden import substrings: any module path that would mean the
# plugin's surface still lives outside its plugin folder.
_FORBIDDEN_IMPORT_FRAGMENTS = (
    "services.whatsapp_service",
    "services.twitter_oauth",
    "services.google_oauth",
    "services.android",        # legacy relay sub-package
    "services.android_service",
    "services.browser_service",
    "services.email_service",
    "services.himalaya_service",
    "services.claude_code_service",
    "routers.twitter",
    "routers.google",
    "routers.android",
    "routers.whatsapp",
)


_SERVER_ROOT = Path(__file__).resolve().parent.parent


class TestRoutersWebsocketHasNoPluginImports:
    """``routers/websocket.py`` is the central dispatch table only.

    It must not import any plugin's service or HTTP-router module by
    name. Plugin commands flow in via ``services.ws_handler_registry``.
    """

    def test_no_plugin_imports_in_websocket_router(self):
        src = inspect.getsource(ws_module)
        offenders = [frag for frag in _FORBIDDEN_IMPORT_FRAGMENTS if frag in src]
        assert not offenders, (
            "routers/websocket.py must not import migrated plugin modules. "
            f"Found references to: {offenders}. "
            "Move handler bodies into nodes/<plugin>/_handlers.py and "
            "self-register via register_ws_handlers."
        )


class TestNoPluginRouterOutsideNodes:
    """Once a plugin owns an HTTP router, the file must live under
    ``nodes/<plugin>/_router.py`` -- never in ``server/routers/``.

    ``server/routers/`` is reserved for cross-cutting routers
    (auth, websocket, webhook, workflow, database, maps,
    nodejs_compat, schemas, credentials). Maps/webhook are recorded
    here as still-shared dispatchers pending a future design pass.
    """

    _MUST_NOT_EXIST = (
        "twitter.py",
        "google.py",
        "android.py",
        "whatsapp.py",
    )

    def test_migrated_plugins_have_no_router_file_in_routers(self):
        routers_dir = _SERVER_ROOT / "routers"
        present = [
            name for name in self._MUST_NOT_EXIST
            if (routers_dir / name).exists()
        ]
        assert not present, (
            f"server/routers/ contains files for migrated plugins: {present}. "
            "These belong under nodes/<plugin>/_router.py and mount via "
            "register_router from the plugin's __init__.py."
        )


class TestPluginInitSelfRegisters:
    """Every migrated plugin folder that ships a ``_handlers.py`` or
    ``_router.py`` must self-register from its ``__init__.py``.

    The package import side-effect is the single wiring point -- nothing
    elsewhere in the tree should be doing the registration on the
    plugin's behalf.
    """

    @pytest.mark.parametrize("plugin", _MIGRATED_PLUGINS)
    def test_plugin_self_registers(self, plugin):
        plugin_dir = _SERVER_ROOT / "nodes" / plugin
        init_path = plugin_dir / "__init__.py"
        if not init_path.exists():
            pytest.skip(f"nodes/{plugin}/ has no __init__.py")

        has_handlers = (plugin_dir / "_handlers.py").exists()
        has_router = (plugin_dir / "_router.py").exists()
        if not (has_handlers or has_router):
            pytest.skip(f"nodes/{plugin}/ ships neither _handlers.py nor _router.py")

        init_src = init_path.read_text(encoding="utf-8")

        if has_handlers:
            assert "register_ws_handlers(" in init_src, (
                f"nodes/{plugin}/_handlers.py exists but "
                f"nodes/{plugin}/__init__.py does not call "
                "register_ws_handlers(...). The plugin's WS surface "
                "would never be wired up at startup."
            )

        if has_router:
            assert "register_router(" in init_src, (
                f"nodes/{plugin}/_router.py exists but "
                f"nodes/{plugin}/__init__.py does not call "
                "register_router(...). The plugin's HTTP router would "
                "never be mounted on the FastAPI app."
            )


class TestRegistryLookupsExist:
    """Sanity: the registries the plugin __init__.py call into must
    exist and expose the documented public functions. Catches accidental
    renames of the registry surface itself.
    """

    def test_register_ws_handlers_exists(self):
        assert hasattr(ws_handler_registry, "register_ws_handlers")
        assert callable(ws_handler_registry.register_ws_handlers)

    def test_register_router_exists(self):
        assert hasattr(ws_handler_registry, "register_router")
        assert callable(ws_handler_registry.register_router)

    def test_get_routers_exists(self):
        assert hasattr(ws_handler_registry, "get_routers")
        assert callable(ws_handler_registry.get_routers)


# Old service paths that were `git mv`'d into nodes/<plugin>/ during
# the migration. None of these should ever be re-created -- if a future
# refactor "needs" one, the work belongs in the plugin folder.
_STALE_SERVICE_PATHS = (
    "services/whatsapp_service.py",
    "services/twitter_oauth.py",
    "services/google_oauth.py",
    "services/handlers/google_auth.py",
    "services/android",                  # the relay sub-package
    "services/android_service.py",
    "services/browser_service.py",
    "services/email_service.py",
    "services/himalaya_service.py",
    "services/claude_code_service.py",
    "services/websocket_client.py",      # dead re-export shim, deleted in E
    "routers/twitter.py",
    "routers/google.py",
    "routers/android.py",
)


class TestStaleServiceFilesAbsent:
    """Files that were moved out of ``services/`` and ``routers/`` during
    the migration must not be re-introduced. Guards against an accidental
    revert via a fresh file (rather than a stale import, which test 1
    catches).
    """

    @pytest.mark.parametrize("relpath", _STALE_SERVICE_PATHS)
    def test_stale_path_does_not_exist(self, relpath: str):
        target = _SERVER_ROOT / relpath
        assert not target.exists(), (
            f"Stale path {relpath!r} re-appeared under server/. "
            "Migrated plugin code lives in nodes/<plugin>/ -- do not "
            "recreate the old location even with new contents."
        )


class TestMainPyDoesNotMountPluginRouters:
    """``server/main.py`` mounts framework routers explicitly
    (auth / websocket / workflow / database / maps / nodejs_compat /
    schemas / credentials / webhook). Plugin routers flow in via the
    ``for r in get_routers(): app.include_router(r)`` loop.

    Direct ``app.include_router(<plugin>.router)`` calls or
    ``from routers import <plugin>`` imports for migrated plugins are
    a regression: they short-circuit the plugin loop and double-mount
    the router under two different code paths.
    """

    _MIGRATED_ROUTER_NAMES = ("twitter", "google", "android", "whatsapp")

    def test_main_py_does_not_explicitly_mount_plugin_routers(self):
        main_path = _SERVER_ROOT / "main.py"
        assert main_path.exists(), "server/main.py missing"
        src = main_path.read_text(encoding="utf-8")
        offenders = [
            name for name in self._MIGRATED_ROUTER_NAMES
            if f"app.include_router({name}.router)" in src
            or f"from routers import {name}" in src
            or f"from routers.{name}" in src
        ]
        assert not offenders, (
            f"server/main.py explicitly mounts/imports migrated plugin routers: "
            f"{offenders}. These must flow in via the get_routers() plugin loop. "
            "Drop the explicit include_router(...) line and the routers.<name> "
            "import; plugin's __init__.py registers via register_router(...)."
        )

    def test_main_py_does_not_wire_plugin_modules(self):
        """``container.wire(modules=[...])`` should not name modules
        that have been migrated into nodes/<plugin>/. Stale wire entries
        for absent modules raise at startup."""
        main_path = _SERVER_ROOT / "main.py"
        src = main_path.read_text(encoding="utf-8")
        offenders = [
            f"routers.{name}" for name in self._MIGRATED_ROUTER_NAMES
            if f'"routers.{name}"' in src
        ]
        assert not offenders, (
            f"server/main.py container.wire(...) names removed plugin modules: "
            f"{offenders}. Drop these entries -- the plugin packages wire their "
            "own dependencies."
        )


class TestPluginHandlersDictsArePopulated:
    """When a plugin ships a ``_handlers.py``, the ``WS_HANDLERS`` dict
    (or whatever the package's ``__init__.py`` imports under that name)
    must register at least one handler. An empty dict is the symptom of
    a partial migration where the file was created but the body wasn't
    moved over.

    The check is loose: we look for the literal ``WS_HANDLERS`` symbol
    in ``_handlers.py`` and assert it isn't an empty literal. This
    catches the most common partial-migration shape without forcing a
    specific dict-construction style.
    """

    @pytest.mark.parametrize("plugin", _MIGRATED_PLUGINS)
    def test_plugin_handlers_dict_non_empty(self, plugin: str):
        handlers_path = _SERVER_ROOT / "nodes" / plugin / "_handlers.py"
        if not handlers_path.exists():
            pytest.skip(f"nodes/{plugin}/ has no _handlers.py")

        src = handlers_path.read_text(encoding="utf-8")
        # Must export WS_HANDLERS (the documented surface used by
        # register_ws_handlers).
        assert "WS_HANDLERS" in src, (
            f"nodes/{plugin}/_handlers.py does not export WS_HANDLERS. "
            "The plugin's __init__.py reads this symbol; absence means "
            "the plugin self-registration is broken."
        )
        # Must not be the empty literal. Stripe builds via
        # make_lifecycle_handlers(...) so we accept either {...} with
        # at least one quoted key OR a function call.
        empty_literal_patterns = (
            "WS_HANDLERS = {}\n",
            "WS_HANDLERS={}\n",
            "WS_HANDLERS: dict = {}\n",
        )
        for pattern in empty_literal_patterns:
            assert pattern not in src, (
                f"nodes/{plugin}/_handlers.py defines an empty WS_HANDLERS dict. "
                "Move the handler bodies into _handlers.py (or wire via "
                "make_lifecycle_handlers) before declaring the migration done."
            )
