from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.database import Base
from app.models.project import Project
from app.repositories.projects import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)


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


def test_project_repository_owner_scoping(db_session: Session) -> None:
    p1 = create_project(db_session, name="User 1 Project", description=None, owner_id=1)
    p2 = create_project(db_session, name="User 2 Project", description=None, owner_id=2)

    # Scoped get
    assert get_project(db_session, project_id=p1.id, owner_id=1) is not None
    assert get_project(db_session, project_id=p1.id, owner_id=2) is None

    # Scoped list
    u1_projects = list_projects(db_session, owner_id=1)
    assert len(u1_projects) == 1
    assert u1_projects[0].id == p1.id

    # Scoped update
    assert update_project(db_session, project_id=p1.id, owner_id=2, name="Hacked") is None
    updated = update_project(db_session, project_id=p1.id, owner_id=1, name="New Name")
    assert updated is not None
    assert updated.name == "New Name"

    # Scoped delete
    assert delete_project(db_session, project_id=p1.id, owner_id=2) is False
    assert delete_project(db_session, project_id=p1.id, owner_id=1) is True
    assert get_project(db_session, project_id=p1.id) is None
