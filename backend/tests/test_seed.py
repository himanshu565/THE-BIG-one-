from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import verify_password
from app.db.database import Base
from app.models.document import Document, DocumentChunk
from app.models.evaluation import EvaluationRun
from app.models.project import Project
from app.models.user import User
from app.scripts.seed import seed_database


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provide an isolated in-memory SQLite database session."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_seed_database_creates_all_entities(db_session: Session) -> None:
    """Verify that seed_database populates users, workspaces, documents, chunks, and evaluations."""
    counts = seed_database(db_session, reset=False, verbose=False)

    assert counts["users"] == 2
    assert counts["projects"] == 3
    assert counts["documents"] == 5
    assert counts["chunks"] >= 9
    assert counts["evaluations"] == 8

    # Verify admin user
    admin = db_session.query(User).filter(User.email == "admin@vectorly.ai").first()
    assert admin is not None
    assert admin.full_name == "Vectorly Administrator"
    assert verify_password("AdminPass123!", admin.hashed_password)

    # Verify engineer user
    engineer = db_session.query(User).filter(User.email == "engineer@vectorly.ai").first()
    assert engineer is not None
    assert engineer.full_name == "Staff AI Engineer"
    assert verify_password("EngineerPass123!", engineer.hashed_password)

    # Verify projects owned by admin
    projects = db_session.query(Project).filter(Project.owner_id == admin.id).all()
    assert len(projects) == 3

    # Verify documents and chunks
    docs = db_session.query(Document).all()
    assert len(docs) == 5
    for doc in docs:
        assert doc.status == "ready"
        assert doc.chunk_count > 0

    # Verify evaluations
    evals = db_session.query(EvaluationRun).all()
    assert len(evals) == 8
    for ev in evals:
        assert ev.status == "Passed"
        assert ev.latency_ms > 0
        assert ev.chunks_found > 0


def test_seed_database_is_idempotent(db_session: Session) -> None:
    """Verify running seeder twice does not duplicate records or crash."""
    counts1 = seed_database(db_session, reset=False, verbose=False)
    assert counts1["users"] == 2
    assert counts1["projects"] == 3

    counts2 = seed_database(db_session, reset=False, verbose=False)
    assert counts2["users"] == 0
    assert counts2["projects"] == 0
    assert counts2["documents"] == 0
    assert counts2["chunks"] == 0
    assert counts2["evaluations"] == 0

    total_users = db_session.query(User).count()
    assert total_users == 2


def test_seed_database_reset_wipes_and_recreates(db_session: Session) -> None:
    """Verify that --reset cleanly purges and re-populates the database."""
    seed_database(db_session, reset=False, verbose=False)
    assert db_session.query(Project).count() == 3

    # Reset seed
    counts = seed_database(db_session, reset=True, verbose=False)
    assert counts["users"] == 2
    assert counts["projects"] == 3
    assert db_session.query(Project).count() == 3
    assert db_session.query(User).count() == 2
