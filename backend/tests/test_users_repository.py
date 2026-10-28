from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import hash_password, verify_password
from app.db.database import Base
from app.models.user import User
from app.repositories.users import create_user, get_user_by_email, get_user_by_id


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


def test_user_repository_crud(db_session: Session) -> None:
    hashed = hash_password("secret123")
    user = create_user(
        db_session,
        email="test@vectorly.ai",
        hashed_password=hashed,
        full_name="Tester",
    )

    assert user.id is not None
    assert user.email == "test@vectorly.ai"
    assert verify_password("secret123", user.hashed_password)
    assert user.is_active is True

    fetched_by_id = get_user_by_id(db_session, user_id=user.id)
    assert fetched_by_id is not None
    assert fetched_by_id.email == "test@vectorly.ai"

    fetched_by_email = get_user_by_email(db_session, email="TEST@vectorly.ai")
    assert fetched_by_email is not None
    assert fetched_by_email.id == user.id

    assert get_user_by_email(db_session, email="missing@vectorly.ai") is None

