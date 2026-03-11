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
