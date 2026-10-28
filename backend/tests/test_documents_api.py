import io
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


def _create_user_and_token(client: TestClient, email: str = "doc_user@vectorly.ai") -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Doc User"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_document_upload_and_ingestion(client: TestClient) -> None:
    headers = _create_user_and_token(client, "alice_docs@vectorly.ai")

    # 1. Create a project
    proj_res = client.post("/api/v1/projects", json={"name": "Engineering Docs"}, headers=headers)
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. Upload a file via multipart form
    file_content = b"# System Architecture\n\nThis is the first chapter of our system architecture.\n\n## Data Flow\n\nData travels through pipelines."
    files = {"file": ("architecture.md", io.BytesIO(file_content), "text/markdown")}
    upload_res = client.post(f"/api/v1/projects/{project_id}/documents/upload", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc = upload_res.json()
    assert doc["name"] == "architecture.md"
    assert doc["file_type"] == "md"
    assert doc["status"] == "ready"
    assert doc["chunk_count"] > 0
    doc_id = doc["id"]

    # 3. List documents for project
    list_res = client.get(f"/api/v1/projects/{project_id}/documents", headers=headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id

    # 4. Filter by status
    filter_res = client.get(f"/api/v1/projects/{project_id}/documents?status=ready", headers=headers)
    assert filter_res.status_code == 200
    assert len(filter_res.json()) == 1

    empty_filter_res = client.get(f"/api/v1/projects/{project_id}/documents?status=failed", headers=headers)
    assert empty_filter_res.status_code == 200
    assert len(empty_filter_res.json()) == 0

    # 5. Get document detail with chunk breakdown
    detail_res = client.get(f"/api/v1/projects/{project_id}/documents/{doc_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == doc_id
    assert len(detail["chunks"]) == doc["chunk_count"]
    assert detail["chunks"][0]["chunk_index"] == 0
    assert "Architecture" in detail["chunks"][0]["content"]

    # 6. Delete document
    del_res = client.delete(f"/api/v1/projects/{project_id}/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 204
    assert client.get(f"/api/v1/projects/{project_id}/documents/{doc_id}", headers=headers).status_code == 404


def test_document_create_via_json(client: TestClient) -> None:
    headers = _create_user_and_token(client, "bob_docs@vectorly.ai")

    proj_res = client.post("/api/v1/projects", json={"name": "Handbook"}, headers=headers)
    project_id = proj_res.json()["id"]

    create_res = client.post(
        f"/api/v1/projects/{project_id}/documents",
        json={
            "name": "onboarding.txt",
            "content": "Welcome to the team!\n\nHere are the instructions for setting up your laptop.",
            "file_type": "txt",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    doc = create_res.json()
    assert doc["name"] == "onboarding.txt"
    assert doc["chunk_count"] >= 1
    assert doc["status"] == "ready"


def test_document_user_isolation(client: TestClient) -> None:
    headers_a = _create_user_and_token(client, "user_a_docs@vectorly.ai")
    headers_b = _create_user_and_token(client, "user_b_docs@vectorly.ai")

    # User A creates a project and document
    proj_res = client.post("/api/v1/projects", json={"name": "User A Private Proj"}, headers=headers_a)
    project_id = proj_res.json()["id"]

    doc_res = client.post(
        f"/api/v1/projects/{project_id}/documents",
        json={"name": "secret.txt", "content": "Confidential financial data"},
        headers=headers_a,
    )
    doc_id = doc_res.json()["id"]

    # User B cannot access User A's documents (project not found 404)
    assert client.get(f"/api/v1/projects/{project_id}/documents", headers=headers_b).status_code == 404
    assert client.get(f"/api/v1/projects/{project_id}/documents/{doc_id}", headers=headers_b).status_code == 404
    assert client.delete(f"/api/v1/projects/{project_id}/documents/{doc_id}", headers=headers_b).status_code == 404

    # User B cannot upload to User A's project
    files = {"file": ("hacked.txt", io.BytesIO(b"malicious"), "text/plain")}
    assert client.post(f"/api/v1/projects/{project_id}/documents/upload", files=files, headers=headers_b).status_code == 404

