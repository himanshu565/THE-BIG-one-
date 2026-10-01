from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.database import Base
from app.models.project import Project
from app.repositories.projects import create_project


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_create_project_persists_and_returns_project(db_session: Session) -> None:
    project = create_project(
        db_session,
        name="Platform docs",
        description="Internal engineering documentation",
        owner_id=7,
    )

    assert project.id is not None
    assert project.name == "Platform docs"
    assert project.description == "Internal engineering documentation"
    assert project.owner_id == 7

    stored = db_session.get(Project, project.id)
    assert stored is not None
    assert stored.name == "Platform docs"
