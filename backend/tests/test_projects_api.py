from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app


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


def _create_user_and_token(client: TestClient, email: str = "user@vectorly.ai") -> tuple[dict[str, str], int]:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Test User"},
    )
    user_id = reg.json()["id"]
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_project_crud_endpoints(client: TestClient) -> None:
    headers, user_id = _create_user_and_token(client, "alice@vectorly.ai")

    # Create project - owner_id is derived from auth, ignoring any supplied owner_id
    created = client.post(
        "/api/v1/projects",
        json={
            "name": "Platform docs",
            "description": "Internal documentation",
            "owner_id": 999,  # Should be overridden by auth user_id
        },
        headers=headers,
    )
    assert created.status_code == 201
    project = created.json()
    assert project["name"] == "Platform docs"
    assert project["owner_id"] == user_id

    # List projects - scoped to user
    listed = client.get("/api/v1/projects", headers=headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [project["id"]]

    # Get single project
    fetched = client.get(f"/api/v1/projects/{project['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == project["id"]

    # Partial update
    updated = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Updated docs", "description": None},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated docs"
    assert updated.json()["description"] is None

    # Delete project
    deleted = client.delete(f"/api/v1/projects/{project['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/projects/{project['id']}", headers=headers).status_code == 404


def test_project_isolation_between_users(client: TestClient) -> None:
    headers_a, _ = _create_user_and_token(client, "user_a@vectorly.ai")
    headers_b, _ = _create_user_and_token(client, "user_b@vectorly.ai")

    # User A creates a project
    create_res = client.post(
        "/api/v1/projects",
        json={"name": "User A secret project"},
        headers=headers_a,
    )
    project_id = create_res.json()["id"]

    # User B cannot see it in list
    list_b = client.get("/api/v1/projects", headers=headers_b)
    assert list_b.status_code == 200
    assert project_id not in [p["id"] for p in list_b.json()]

    # User B cannot fetch it by ID (returns 404 for security)
    get_b = client.get(f"/api/v1/projects/{project_id}", headers=headers_b)
    assert get_b.status_code == 404

    # User B cannot update it
    patch_b = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Hacked"},
        headers=headers_b,
    )
    assert patch_b.status_code == 404

    # User B cannot delete it
    del_b = client.delete(f"/api/v1/projects/{project_id}", headers=headers_b)
    assert del_b.status_code == 404

    # User A can still fetch it
    get_a = client.get(f"/api/v1/projects/{project_id}", headers=headers_a)
    assert get_a.status_code == 200


def test_project_unauthorized_and_validation(client: TestClient) -> None:
    # Unauthenticated requests return 401
    assert client.get("/api/v1/projects").status_code == 401
    assert client.post("/api/v1/projects", json={"name": "test"}).status_code == 401

    headers, _ = _create_user_and_token(client, "bob@vectorly.ai")

    # Empty name fails validation
    invalid = client.post("/api/v1/projects", json={"name": ""}, headers=headers)
    assert invalid.status_code == 422

    # Non-existent project returns 404
    missing = client.get("/api/v1/projects/9999", headers=headers)
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Project not found"}
