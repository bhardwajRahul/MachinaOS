"""Project configuration -- ports + flags from ``.env``.

Backed by ``pydantic-settings``: typed fields with automatic env-var
coercion, no hand-rolled int/bool parsers. The model loads ``.env``
(or ``.env.template`` as fallback) from the project root.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from machina.platform_ import project_root


def _env_file(root: Path) -> Path:
    primary = root / ".env"
    fallback = root / ".env.template"
    return primary if primary.exists() else fallback


class Config(BaseSettings):
    """Typed view over ``.env``; defaults match the JS ``loadEnvConfig``."""

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    client_port: int = Field(default=3000, alias="VITE_CLIENT_PORT")
    backend_port: int = Field(default=3010, alias="PYTHON_BACKEND_PORT")
    whatsapp_port: int = Field(default=9400, alias="WHATSAPP_RPC_PORT")
    nodejs_port: int = Field(default=3020, alias="NODEJS_EXECUTOR_PORT")
    temporal_address: str = Field(default="localhost:7233", alias="TEMPORAL_SERVER_ADDRESS")
    temporal_enabled: bool = Field(default=True, alias="TEMPORAL_ENABLED")

    @property
    def temporal_port(self) -> int:
        try:
            return int(self.temporal_address.rsplit(":", 1)[-1])
        except (ValueError, IndexError):
            return 7233

    @property
    def all_ports(self) -> list[int]:
        return [
            self.client_port,
            self.backend_port,
            self.whatsapp_port,
            self.nodejs_port,
            self.temporal_port,
        ]


@lru_cache(maxsize=1)
def load_config(root: Path | None = None) -> Config:
    root = root or project_root()
    return Config(_env_file=str(_env_file(root)))
