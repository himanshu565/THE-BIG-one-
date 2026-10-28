import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config.settings import get_settings
from app.db.database import get_db
from app.models.user import User
from app.repositories import projects
from app.schemas.query import QueryRequest, QueryResponse, SourceCitation
from app.services.llm import get_llm_provider
from app.services.retrieval import retrieve_chunks

router = APIRouter(prefix="/projects/{project_id}", tags=["retrieval"])


def _verify_project_ownership(db: Session, project_id: int, user_id: int) -> None:
    project = projects.get_project(db, project_id=project_id, owner_id=user_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.post("/query", response_model=QueryResponse)
def query_project_knowledge_base(
    project_id: int,
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueryResponse:
    """Submit a question to the project knowledge base, run hybrid retrieval, and generate a grounded answer."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)
    start_time = time.perf_counter()

    sources = retrieve_chunks(
        db,
        project_id=project_id,
        query=payload.question,
        top_k=payload.top_k,
        mode=payload.mode,
    )

    llm = get_llm_provider()
    answer = llm.generate_grounded_answer(payload.question, sources)
    latency_ms = int((time.perf_counter() - start_time) * 1000)

    settings = get_settings()
    return QueryResponse(
        question=payload.question,
        answer=answer,
        sources=sources,
        retrieval_mode=payload.mode,
        provider=settings.llm_provider,
        model=settings.llm_model,
        latency_ms=latency_ms,
    )


@router.post("/search", response_model=list[SourceCitation])
def search_project_chunks(
    project_id: int,
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SourceCitation]:
    """Retrieve top-K source chunks without LLM synthesis."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)
    return retrieve_chunks(
        db,
        project_id=project_id,
        query=payload.question,
        top_k=payload.top_k,
        mode=payload.mode,
    )

