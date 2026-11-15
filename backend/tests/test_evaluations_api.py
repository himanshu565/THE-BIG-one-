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
    """Test client backed by an isolated in-memory SQLite database."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


def _auth_headers(client: TestClient, email: str = "evaluator@vectorly.ai") -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Evaluator User"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_record_and_list_evaluations(client: TestClient) -> None:
    headers = _auth_headers(client)

    # 1. Create project
    proj = client.post("/api/v1/projects", json={"name": "Eval Project"}, headers=headers).json()
    project_id = proj["id"]

    # 2. Record evaluation run
    eval_payload = {
        "query": "architecture and system design overview",
        "latency_ms": 145,
        "chunks_found": 4,
        "mode": "hybrid",
        "status": "Passed",
    }
    create_res = client.post(
        f"/api/v1/projects/{project_id}/evaluations", json=eval_payload, headers=headers
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["id"] is not None
    assert created["project_id"] == project_id
    assert created["query"] == "architecture and system design overview"
    assert created["latency_ms"] == 145
    assert created["chunks_found"] == 4
    assert created["status"] == "Passed"

    # 3. List evaluations
    list_res = client.get(f"/api/v1/projects/{project_id}/evaluations", headers=headers)
    assert list_res.status_code == 200
    runs = list_res.json()
    assert len(runs) == 1
    assert runs[0]["id"] == created["id"]


def test_evaluations_cross_tenant_isolation(client: TestClient) -> None:
    headers_user_a = _auth_headers(client, "user_a@vectorly.ai")
    headers_user_b = _auth_headers(client, "user_b@vectorly.ai")

    # User A creates project and evaluation run
    proj_a = client.post("/api/v1/projects", json={"name": "User A Workspace"}, headers=headers_user_a).json()
    eval_a = client.post(
        f"/api/v1/projects/{proj_a['id']}/evaluations",
        json={"query": "secret query", "latency_ms": 100, "chunks_found": 2},
        headers=headers_user_a,
    ).json()

    # User B cannot view User A's evaluations
    unauthorized_list = client.get(f"/api/v1/projects/{proj_a['id']}/evaluations", headers=headers_user_b)
    assert unauthorized_list.status_code == 404

    # User B cannot post to User A's evaluations
    unauthorized_post = client.post(
        f"/api/v1/projects/{proj_a['id']}/evaluations",
        json={"query": "intruder query", "latency_ms": 50, "chunks_found": 1},
        headers=headers_user_b,
    )
    assert unauthorized_post.status_code == 404


def test_evaluation_validation_errors(client: TestClient) -> None:
    headers = _auth_headers(client, "validator@vectorly.ai")
    proj = client.post("/api/v1/projects", json={"name": "Validation Project"}, headers=headers).json()

    # Empty query rejected
    empty_q_res = client.post(
        f"/api/v1/projects/{proj['id']}/evaluations",
        json={"query": "", "latency_ms": 50, "chunks_found": 1},
        headers=headers,
    )
    assert empty_q_res.status_code == 422

    # Negative latency rejected
    neg_lat_res = client.post(
        f"/api/v1/projects/{proj['id']}/evaluations",
        json={"query": "test query", "latency_ms": -10, "chunks_found": 1},
        headers=headers,
    )
    assert neg_lat_res.status_code == 422


def test_evaluations_pagination(client: TestClient) -> None:
    headers = _auth_headers(client, "paging@vectorly.ai")
    proj = client.post("/api/v1/projects", json={"name": "Paging Project"}, headers=headers).json()

    for i in range(5):
        client.post(
            f"/api/v1/projects/{proj['id']}/evaluations",
            json={"query": f"query {i}", "latency_ms": 100 + i, "chunks_found": i},
            headers=headers,
        )

    # Fetch page of size 2
    page1 = client.get(f"/api/v1/projects/{proj['id']}/evaluations?limit=2&offset=0", headers=headers).json()
    assert len(page1) == 2

    # Fetch second page
    page2 = client.get(f"/api/v1/projects/{proj['id']}/evaluations?limit=2&offset=2", headers=headers).json()
    assert len(page2) == 2
    assert page1[0]["id"] != page2[0]["id"]
