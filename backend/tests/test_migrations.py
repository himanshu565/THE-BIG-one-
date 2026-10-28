import os
import tempfile
from collections.abc import Generator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.config.settings import get_settings


@pytest.fixture
def temp_db() -> Generator[str, None, None]:
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    try:
        yield db_path
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_alembic_migrations_upgrade_and_downgrade(temp_db: str, monkeypatch: pytest.MonkeyPatch) -> None:
    db_url = f"sqlite:///{temp_db}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    get_settings.cache_clear()

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ini_path = os.path.join(backend_dir, "alembic.ini")

    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    try:
        # 1. Upgrade to head
        command.upgrade(alembic_cfg, "head")

        engine = create_engine(db_url)
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())

        assert "users" in table_names
        assert "projects" in table_names
        assert "alembic_version" in table_names

        user_columns = {col["name"] for col in inspector.get_columns("users")}
        assert {"id", "email", "hashed_password", "full_name", "is_active", "created_at"}.issubset(user_columns)

        project_columns = {col["name"] for col in inspector.get_columns("projects")}
        assert {"id", "name", "description", "owner_id", "created_at"}.issubset(project_columns)

        engine.dispose()

        # 2. Downgrade to base
        command.downgrade(alembic_cfg, "base")

        engine = create_engine(db_url)
        inspector = inspect(engine)
        downgraded_tables = set(inspector.get_table_names())
        assert "users" not in downgraded_tables
        assert "projects" not in downgraded_tables
        engine.dispose()
    finally:
        get_settings.cache_clear()
