from fastapi import FastAPI

from app.api.projects import router as projects_router
from app.config.settings import get_settings


settings = get_settings()
app = FastAPI(
    title="Vectorly API",
    description="Backend API for the Retrieval-Aware AI Infrastructure Platform.",
    version="0.1.0",
)
app.include_router(projects_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    """Return a lightweight liveness response."""
    return {"status": "ok"}
