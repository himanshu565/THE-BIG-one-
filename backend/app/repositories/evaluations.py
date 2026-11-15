"""Repository operations for evaluation benchmark runs."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evaluation import EvaluationRun
from app.schemas.evaluation import EvaluationCreate


def create_evaluation_run(db: Session, project_id: int, data: EvaluationCreate) -> EvaluationRun:
    """Persist a new evaluation benchmark run for a project."""
    run = EvaluationRun(
        project_id=project_id,
        query=data.query,
        latency_ms=data.latency_ms,
        chunks_found=data.chunks_found,
        mode=data.mode,
        status=data.status,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def list_evaluation_runs(
    db: Session, project_id: int, limit: int = 50, offset: int = 0
) -> list[EvaluationRun]:
    """Return persisted evaluation runs for a project ordered newest first."""
    stmt = (
        select(EvaluationRun)
        .where(EvaluationRun.project_id == project_id)
        .order_by(EvaluationRun.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).all())
