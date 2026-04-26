""".env loader + port resolution.

Mirrors what ``scripts/utils.js:loadEnvConfig`` does, using
``python-dotenv`` instead of a custom parser.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values

from machina.platform_ import project_root


@dataclass(frozen=True)
class Ports:
    client: int
    backend: int
    whatsapp: int
    nodejs: int
    temporal: int

    def all(self) -> list[int]:
        return [self.client, self.backend, self.whatsapp, self.nodejs, self.temporal]


@dataclass(frozen=True)
class Config:
    raw: dict[str, str | None] = field(default_factory=dict)
    ports: Ports = field(default_factory=lambda: Ports(3000, 3010, 9400, 3020, 7233))
    temporal_enabled: bool = True
    redis_enabled: bool = False


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"true", "1", "yes", "on"}


def _int(value: str | None, default: int) -> int:
    try:
        return int(value) if value else default
    except (TypeError, ValueError):
        return default


def _temporal_port(address: str | None) -> int:
    if not address:
        return 7233
    try:
        return int(address.rsplit(":", 1)[-1])
    except (ValueError, IndexError):
        return 7233


def load_config(root: Path | None = None) -> Config:
    root = root or project_root()
    env_path = root / ".env"
    if not env_path.exists():
        env_path = root / ".env.template"
    raw = dotenv_values(env_path) if env_path.exists() else {}

    ports = Ports(
        client=_int(raw.get("VITE_CLIENT_PORT"), 3000),
        backend=_int(raw.get("PYTHON_BACKEND_PORT"), 3010),
        whatsapp=_int(raw.get("WHATSAPP_RPC_PORT"), 9400),
        nodejs=_int(raw.get("NODEJS_EXECUTOR_PORT"), 3020),
        temporal=_temporal_port(raw.get("TEMPORAL_SERVER_ADDRESS")),
    )
    return Config(
        raw=dict(raw),
        ports=ports,
        temporal_enabled=_truthy(raw.get("TEMPORAL_ENABLED")) or True,
        redis_enabled=_truthy(raw.get("REDIS_ENABLED")),
    )
