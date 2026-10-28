from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app
from app.models.user import User


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_register_user_success(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "developer@vectorly.ai",
            "password": "securepassword123",
            "full_name": "Dev User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["email"] == "developer@vectorly.ai"
    assert data["full_name"] == "Dev User"
    assert data["is_active"] is True
    assert "hashed_password" not in data


def test_register_duplicate_email_fails(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "developer@vectorly.ai", "password": "securepassword123"},
    )
    duplicate = client.post(
        "/api/v1/auth/register",
        json={"email": "developer@vectorly.ai", "password": "anotherpassword123"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "A user with this email already exists"


def test_register_validation_errors(client: TestClient) -> None:
    # Short password
    res_short = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "123"},
    )
    assert res_short.status_code == 422

    # Invalid email
    res_email = client.post(
        "/api/v1/auth/register",
        json={"email": "invalid-email-string", "password": "securepassword123"},
    )
    assert res_email.status_code == 422


def test_login_success(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@vectorly.ai", "password": "mypassword123"},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "login@vectorly.ai", "password": "mypassword123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@vectorly.ai", "password": "mypassword123"},
    )
    wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"email": "login@vectorly.ai", "password": "wrongpassword"},
    )
    assert wrong_pw.status_code == 401

    wrong_email = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@vectorly.ai", "password": "mypassword123"},
    )
    assert wrong_email.status_code == 401


def test_get_me_profile(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "me@vectorly.ai", "password": "mypassword123", "full_name": "Me User"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "me@vectorly.ai", "password": "mypassword123"},
    )
    token = login_res.json()["access_token"]

    # Authorized request
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "me@vectorly.ai"
    assert me_res.json()["full_name"] == "Me User"

    # Unauthorized request without header
    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401

    # Unauthorized request with bad token
    bad_token_res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer badtoken"})
    assert bad_token_res.status_code == 401

