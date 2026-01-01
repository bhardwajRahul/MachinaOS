"""Environment-driven configuration with Pydantic v2."""

from typing import List, Literal, Optional
from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings driven entirely by environment variables."""

    # Server Configuration
    host: str = Field(env="HOST")
    port: int = Field(env="PORT", ge=1024, le=65535)
    debug: bool = Field(default=False, env="DEBUG")
    workers: int = Field(default=1, env="WORKERS", ge=1, le=8)

    # Authentication
    auth_mode: Literal["single", "multi"] = Field(default="single", env="AUTH_MODE")
    jwt_secret_key: str = Field(env="JWT_SECRET_KEY", min_length=32)
    jwt_expire_minutes: int = Field(default=10080, env="JWT_EXPIRE_MINUTES", ge=60)  # 7 days
    jwt_cookie_name: str = Field(default="machina_token", env="JWT_COOKIE_NAME")
    jwt_cookie_secure: bool = Field(default=False, env="JWT_COOKIE_SECURE")  # True in production
    jwt_cookie_samesite: Literal["lax", "strict", "none"] = Field(default="lax", env="JWT_COOKIE_SAMESITE")

    # Security
    secret_key: str = Field(env="SECRET_KEY", min_length=32)
    cors_origins: List[str] = Field(env="CORS_ORIGINS")

    # Database Configuration
    database_url: str = Field(env="DATABASE_URL")
    database_echo: bool = Field(default=False, env="DATABASE_ECHO")
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE", ge=5, le=100)
    database_max_overflow: int = Field(default=30, env="DATABASE_MAX_OVERFLOW", ge=10, le=100)

    # Cache Configuration
    redis_url: Optional[str] = Field(default=None, env="REDIS_URL")
    redis_enabled: bool = Field(default=False, env="REDIS_ENABLED")
    cache_ttl: int = Field(default=3600, env="CACHE_TTL", ge=60)

    # Execution Engine
    dlq_enabled: bool = Field(default=False, env="DLQ_ENABLED")

    # API Keys (all optional, injected at runtime)
    google_maps_api_key: Optional[str] = Field(default=None, env="GOOGLE_MAPS_API_KEY")
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    google_ai_api_key: Optional[str] = Field(default=None, env="GOOGLE_AI_API_KEY")

    # WhatsApp Service URL (Flask service)
    whatsapp_service_url: str = Field(default="http://localhost:5000", env="WHATSAPP_SERVICE_URL")

    # WebSocket Configuration
    websocket_url: str = Field(default="", env="WEBSOCKET_URL")
    websocket_api_key: Optional[str] = Field(default=None, env="WEBSOCKET_API_KEY")

    # API Key Security
    api_key_encryption_key: str = Field(env="API_KEY_ENCRYPTION_KEY", min_length=32)
    api_key_cache_ttl: int = Field(default=2592000, env="API_KEY_CACHE_TTL", ge=3600)

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")

    # Rate Limiting
    rate_limit_enabled: bool = Field(default=True, env="RATE_LIMIT_ENABLED")
    rate_limit_requests: int = Field(default=100, env="RATE_LIMIT_REQUESTS", ge=10)
    rate_limit_window: int = Field(default=60, env="RATE_LIMIT_WINDOW", ge=10)

    # Service Timeouts
    ai_timeout: int = Field(default=30, env="AI_TIMEOUT", ge=5, le=300)
    ai_max_retries: int = Field(default=3, env="AI_MAX_RETRIES", ge=0, le=5)
    ai_retry_delay: float = Field(default=1.0, env="AI_RETRY_DELAY", ge=0.1, le=10.0)

    maps_timeout: int = Field(default=10, env="MAPS_TIMEOUT", ge=5, le=60)
    maps_max_requests_per_second: int = Field(default=50, env="MAPS_MAX_RPS", ge=1, le=1000)

    # Health Check
    health_check_interval: int = Field(default=30, env="HEALTH_CHECK_INTERVAL", ge=10)

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v):
        """Ensure database directory exists for SQLite."""
        if v and v.startswith("sqlite"):
            if ":///" in v:
                db_path = v.split("///")[1]
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        return v


    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.debug

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return not self.debug

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "forbid",
        "env_parse_none_str": "none",
        "env_nested_delimiter": "__",
    }