from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_DEFAULT_DB_URL = f"sqlite:///{(_BACKEND_DIR / 'vectorly.db').as_posix()}"


class Settings(BaseSettings):
    """Validated runtime configuration loaded from environment variables."""

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    database_url: str = Field(
        default=_DEFAULT_DB_URL,
        validation_alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")
    llm_provider: str = Field(default="mock", validation_alias="LLM_PROVIDER")
    llm_model: str = Field(default="local-development", validation_alias="LLM_MODEL")
    jwt_secret_key: str = Field(
        default="09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
        validation_alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=60, validation_alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    # Security & Anti-Hack Configuration
    cors_origins: list[str] | str = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"],
        validation_alias="CORS_ORIGINS",
    )
    rate_limit_enabled: bool = Field(default=True, validation_alias="RATE_LIMIT_ENABLED")
    auth_rate_limit_per_minute: int = Field(
        default=20, validation_alias="AUTH_RATE_LIMIT_PER_MINUTE"
    )
    query_rate_limit_per_minute: int = Field(
        default=60, validation_alias="QUERY_RATE_LIMIT_PER_MINUTE"
    )
    global_rate_limit_per_minute: int = Field(
        default=300, validation_alias="GLOBAL_RATE_LIMIT_PER_MINUTE"
    )
    max_upload_size_bytes: int = Field(
        default=10 * 1024 * 1024, validation_alias="MAX_UPLOAD_SIZE_BYTES"  # 10 MB
    )
    prompt_guard_enabled: bool = Field(default=True, validation_alias="PROMPT_GUARD_ENABLED")

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list of strings."""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return list(self.cors_origins)

    @field_validator(
        "app_env",
        "llm_provider",
        "llm_model",
        "jwt_secret_key",
        "jwt_algorithm",
    )
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("configuration values cannot be blank")
        return value


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object for the application process."""
    return Settings()
