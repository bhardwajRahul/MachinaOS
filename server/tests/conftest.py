"""Shared fixtures for native LLM provider tests."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

# Ensure server/ is on sys.path
SERVER_DIR = Path(__file__).parent.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))


# Stub core.logging before any provider import
def _stub_module(name: str) -> MagicMock:
    if name not in sys.modules:
        sys.modules[name] = MagicMock()
    return sys.modules[name]


_stub_module("core")
_core_logging = _stub_module("core.logging")
_core_logging.get_logger = MagicMock(return_value=MagicMock())


# Wave 10.C: discover node plugins once per test session so every test
# sees the fully-populated NODE_METADATA + handler + input/output
# registries. Previously the legacy hardcoded NODE_METADATA dict seeded
# entries at import; now plugin modules do, and they have to run before
# any test calls get_node_spec() / NODE_METADATA.get(...).
try:
    import nodes  # noqa: F401,E402  — side-effect: register_node calls
except Exception:
    # If plugin discovery fails (e.g. stubs not complete), let individual
    # tests surface the error rather than crashing collection.
    pass
