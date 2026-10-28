from sqlalchemy.orm import Session

from app.models.user import User


def create_user(
    db: Session,
    *,
    email: str,
    hashed_password: str,
    full_name: str | None = None,
) -> User:
    """Persist a new user and return the refreshed entity."""
    user = User(
        email=email.strip().lower(),
        hashed_password=hashed_password,
        full_name=full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, *, user_id: int) -> User | None:
    """Return a user by primary key."""
    return db.get(User, user_id)


def get_user_by_email(db: Session, *, email: str) -> User | None:
    """Return a user by email address."""
    return db.query(User).filter(User.email == email.strip().lower()).first()

