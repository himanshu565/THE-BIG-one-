"""API endpoints for recording and viewing retrieval evaluation benchmark runs."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.repositories import evaluations, projects
from app.schemas.evaluation import EvaluationCreate, EvaluationOut

router = APIRouter(prefix="/projects/{project_id}/evaluations", tags=["evaluations"])


def _verify_project_ownership(db: Session, project_id: int, user_id: int) -> None:
    project = projects.get_project(db, project_id=project_id, owner_id=user_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
def record_evaluation_run(
    project_id: int,
    payload: EvaluationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EvaluationOut:
    """Record a completed retrieval quality evaluation benchmark run."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)
    return evaluations.create_evaluation_run(db, project_id=project_id, data=payload)


@router.get("", response_model=list[EvaluationOut])
def list_evaluation_runs(
    project_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EvaluationOut]:
    """List historical evaluation benchmark runs for an owned project."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)
    return evaluations.list_evaluation_runs(db, project_id=project_id, limit=limit, offset=offset)
