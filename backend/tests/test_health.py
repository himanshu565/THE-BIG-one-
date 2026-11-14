from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.db.database import get_db
from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert "environment" in data
    assert "version" in data
    # Ensure X-Request-ID correlation header was attached
    assert "x-request-id" in response.headers


def test_health_returns_503_when_database_unreachable() -> None:
    # Simulate DB disconnection
    failing_db = MagicMock()
    failing_db.execute.side_effect = Exception("Connection to PostgreSQL failed: connection refused")

    app.dependency_overrides[get_db] = lambda: failing_db
    try:
        response = client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "connection refused" in data["error"]
    finally:
        app.dependency_overrides.pop(get_db, None)

