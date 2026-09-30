import pytest
from pydantic import ValidationError

from app.config.settings import Settings


def test_settings_use_local_development_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.app_env == "development"
    assert settings.llm_provider == "mock"
    assert settings.llm_model == "local-development"


def test_settings_read_environment_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/vectorly_test")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "test-model")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.database_url == "postgresql://example/vectorly_test"
    assert settings.llm_provider == "openai"
    assert settings.llm_model == "test-model"


def test_settings_reject_blank_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", " ")

    with pytest.raises(ValidationError, match="cannot be blank"):
        Settings(_env_file=None)
