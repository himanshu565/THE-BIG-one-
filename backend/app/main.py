from fastapi import FastAPI

from app.config.settings import get_settings


settings = get_settings()
app = FastAPI(
    title="Vectorly API",
    description="Backend API for the Retrieval-Aware AI Infrastructure Platform.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    """Return a lightweight liveness response."""
    return {"status": "ok"}
