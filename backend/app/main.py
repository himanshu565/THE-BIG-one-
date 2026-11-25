from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.evaluations import router as evaluations_router
from app.api.projects import router as projects_router
from app.api.retrieval import router as retrieval_router
from app.config.settings import get_settings
from app.core.logging import RequestCorrelationMiddleware, configure_logging
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.db.database import Base, engine, get_db
import app.models  # Register all models with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize structured JSON logging
    configure_logging()
    # Automatically ensure tables exist on startup (helpful for zero-config SQLite development)
    try:
        Base.metadata.create_all(bind=engine)
        from sqlalchemy import inspect
        inspector = inspect(engine)
        if "document_chunks" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("document_chunks")}
            if "embedding" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding TEXT;"))
                    conn.commit()
    except Exception:
        pass
    yield


settings = get_settings()
app = FastAPI(
    title="Vectorly API",
    description="Backend API for the Retrieval-Aware AI Infrastructure Platform.",
    version="0.1.0",
    lifespan=lifespan,
)

# 1. Request Correlation & Observability Middleware (X-Request-ID)
app.add_middleware(RequestCorrelationMiddleware)

# 2. Defensive HTTP Security Headers (OWASP Top 10)
app.add_middleware(SecurityHeadersMiddleware)

# 3. Rate Limiting Middleware (Anti-Brute-Force & Anti-DoS)
app.add_middleware(RateLimitMiddleware)

# 4. Hardened CORS Configuration
cors_origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True if "*" not in cors_origins else False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(retrieval_router, prefix="/api/v1")
app.include_router(evaluations_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    """Return API service metadata and navigation links."""
    return {
        "service": "Vectorly API",
        "status": "running",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health(response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Return platform and database readiness status."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected",
            "environment": settings.app_env,
            "version": "0.1.0",
        }
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(exc),
            "environment": settings.app_env,
            "version": "0.1.0",
        }
