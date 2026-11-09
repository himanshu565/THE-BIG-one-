from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.projects import router as projects_router
from app.api.retrieval import router as retrieval_router
from app.config.settings import get_settings
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.db.database import Base, engine
import app.models  # Register all models with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically ensure tables exist on startup (helpful for zero-config SQLite development)
    try:
        Base.metadata.create_all(bind=engine)
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

# 1. Defensive HTTP Security Headers (OWASP Top 10)
app.add_middleware(SecurityHeadersMiddleware)

# 2. Rate Limiting Middleware (Anti-Brute-Force & Anti-DoS)
app.add_middleware(RateLimitMiddleware)

# 3. Hardened CORS Configuration
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


@app.get("/health")
def health() -> dict[str, str]:
    """Return a lightweight liveness response."""
    return {"status": "ok"}
