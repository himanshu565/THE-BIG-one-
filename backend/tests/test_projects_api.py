from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker

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


def test_project_crud_endpoints(client: TestClient) -> None:
    created = client.post(
        "/api/v1/projects",
        json={
            "name": "Platform docs",
            "description": "Internal documentation",
            "owner_id": 7,
        },
    )
    assert created.status_code == 201
    project = created.json()
    assert project["name"] == "Platform docs"
    assert project["owner_id"] == 7

    listed = client.get("/api/v1/projects", params={"owner_id": 7})
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [project["id"]]

    updated = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Updated docs", "description": None},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated docs"
    assert updated.json()["description"] is None

    deleted = client.delete(f"/api/v1/projects/{project['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/projects/{project['id']}").status_code == 404


def test_project_validation_and_not_found(client: TestClient) -> None:
    invalid = client.post("/api/v1/projects", json={"name": "", "owner_id": 0})
    assert invalid.status_code == 422

    missing = client.get("/api/v1/projects/999")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Project not found"}
