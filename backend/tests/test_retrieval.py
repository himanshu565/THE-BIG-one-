from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app
from app.services.retrieval import bm25_rank, reciprocal_rank_fusion, semantic_vector_rank


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


def _create_user_and_token(client: TestClient, email: str = "rag_user@vectorly.ai") -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "RAG User"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_ranking_algorithms() -> None:
    query = ["retrieval", "latency", "budget"]
    doc1 = ["retrieval", "latency", "budget", "is", "200ms"]
    doc2 = ["customer", "support", "ticket", "export"]
    corpus = [doc1, doc2]

    bm25 = bm25_rank(query, corpus)
    assert bm25[0] > bm25[1]
    assert bm25[1] == 0.0

    semantic = semantic_vector_rank(query, corpus)
    assert semantic[0] > semantic[1]

    fused = reciprocal_rank_fusion([0, 1], [0, 1], total_docs=2)
    assert fused[0][0] == 0


def test_query_project_with_grounded_answer(client: TestClient) -> None:
    headers = _create_user_and_token(client, "alice_rag@vectorly.ai")

    # 1. Create a project
    proj_res = client.post("/api/v1/projects", json={"name": "Platform Docs"}, headers=headers)
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. Add documentation
    doc_text = (
        "Production Retrieval SLOs\n\n"
        "Our RAG latency budget is strictly 200 milliseconds.\n"
        "Groundedness threshold must exceed 95 percent across production queries.\n\n"
        "Deployment Architecture\n\n"
        "All vector embeddings are indexed using HNSW with cosine distance."
    )
    doc_res = client.post(
        f"/api/v1/projects/{project_id}/documents",
        json={"name": "slos.md", "content": doc_text, "file_type": "md"},
        headers=headers,
    )
    assert doc_res.status_code == 201

    # 3. Query the knowledge base
    query_res = client.post(
        f"/api/v1/projects/{project_id}/query",
        json={"question": "What is our RAG latency budget?", "top_k": 3, "mode": "hybrid"},
        headers=headers,
    )
    assert query_res.status_code == 200
    data = query_res.json()
    assert data["question"] == "What is our RAG latency budget?"
    assert "latency budget" in data["answer"].lower()
    assert len(data["sources"]) > 0
    assert data["sources"][0]["document_name"] == "slos.md"
    assert data["retrieval_mode"] == "hybrid"
    assert data["latency_ms"] >= 0


def test_search_endpoint_without_synthesis(client: TestClient) -> None:
    headers = _create_user_and_token(client, "bob_rag@vectorly.ai")

    proj_res = client.post("/api/v1/projects", json={"name": "Architecture"}, headers=headers)
    project_id = proj_res.json()["id"]

    client.post(
        f"/api/v1/projects/{project_id}/documents",
        json={"name": "arch.txt", "content": "Microservices communicate via gRPC and Kafka."},
        headers=headers,
    )

    search_res = client.post(
        f"/api/v1/projects/{project_id}/search",
        json={"question": "Kafka gRPC microservices", "top_k": 2, "mode": "bm25"},
        headers=headers,
    )
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) >= 1
    assert results[0]["document_name"] == "arch.txt"
    assert results[0]["score"] > 0.0


def test_query_empty_project(client: TestClient) -> None:
    headers = _create_user_and_token(client, "carol_rag@vectorly.ai")

    proj_res = client.post("/api/v1/projects", json={"name": "Empty Project"}, headers=headers)
    project_id = proj_res.json()["id"]

    query_res = client.post(
        f"/api/v1/projects/{project_id}/query",
        json={"question": "Any documents here?"},
        headers=headers,
    )
    assert query_res.status_code == 200
    data = query_res.json()
    assert data["sources"] == []
    assert "could not find any relevant information" in data["answer"].lower()


def test_query_user_isolation(client: TestClient) -> None:
    headers_a = _create_user_and_token(client, "owner_a@vectorly.ai")
    headers_b = _create_user_and_token(client, "intruder_b@vectorly.ai")

    proj_res = client.post("/api/v1/projects", json={"name": "Confidential"}, headers=headers_a)
    project_id = proj_res.json()["id"]

    # User B cannot query or search User A's project
    assert client.post(f"/api/v1/projects/{project_id}/query", json={"question": "secret"}, headers=headers_b).status_code == 404
    assert client.post(f"/api/v1/projects/{project_id}/search", json={"question": "secret"}, headers=headers_b).status_code == 404

