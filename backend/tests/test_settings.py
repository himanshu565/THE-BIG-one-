import pytest
from pydantic import ValidationError

from app.config.settings import Settings


def test_settings_use_local_development_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.app_env == "development"
    assert settings.llm_provider == "mock"
    assert settings.llm_model == "local-development"
    assert settings.jwt_algorithm == "HS256"
    assert settings.jwt_access_token_expire_minutes == 60


def test_settings_read_environment_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/vectorly_test")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("JWT_SECRET_KEY", "super-secret-key-12345678901234567890")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.database_url == "postgresql://example/vectorly_test"
    assert settings.llm_provider == "openai"
    assert settings.llm_model == "test-model"
    assert settings.jwt_secret_key == "super-secret-key-12345678901234567890"


def test_settings_reject_blank_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", " ")

    with pytest.raises(ValidationError, match="cannot be blank"):
        Settings(_env_file=None)


def test_settings_reject_blank_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", " ")

    with pytest.raises(ValidationError, match="cannot be blank"):
        Settings(_env_file=None)
