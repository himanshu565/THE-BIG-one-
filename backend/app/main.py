from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.projects import router as projects_router
from app.api.retrieval import router as retrieval_router
from app.config.settings import get_settings
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
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
