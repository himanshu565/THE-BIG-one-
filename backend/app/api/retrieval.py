from collections.abc import Generator
import json
import time

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config.settings import get_settings
from app.core.sanitizer import guard_prompt_query
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
    settings = get_settings()

    # Guard against prompt injection and adversarial delimiter hijacking
    question = (
        guard_prompt_query(payload.question)
        if settings.prompt_guard_enabled
        else payload.question
    )

    start_time = time.perf_counter()

    sources = retrieve_chunks(
        db,
        project_id=project_id,
        query=question,
        top_k=payload.top_k,
        mode=payload.mode,
    )

    try:
        llm = get_llm_provider()
        answer = llm.generate_grounded_answer(question, sources)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM synthesis error ({settings.llm_provider}): {str(exc)}",
        )

    latency_ms = int((time.perf_counter() - start_time) * 1000)

    return QueryResponse(
        question=payload.question,
        answer=answer,
        sources=sources,
        retrieval_mode=payload.mode,
        provider=settings.llm_provider,
        model=settings.llm_model,
        latency_ms=latency_ms,
    )


@router.post("/query/stream")
def query_project_knowledge_base_stream(
    project_id: int,
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Submit a question to the project knowledge base, run hybrid retrieval, and stream a grounded answer via SSE."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)
    settings = get_settings()

    # Guard against prompt injection and adversarial delimiter hijacking
    question = (
        guard_prompt_query(payload.question)
        if settings.prompt_guard_enabled
        else payload.question
    )

    start_time = time.perf_counter()

    sources = retrieve_chunks(
        db,
        project_id=project_id,
        query=question,
        top_k=payload.top_k,
        mode=payload.mode,
    )

    try:
        llm = get_llm_provider()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    def event_generator() -> Generator[str, None, None]:
        # 1. Send initial event with retrieved sources metadata
        sources_data = json.dumps({
            "sources": [
                {
                    "document_id": s.document_id,
                    "document_name": s.document_name,
                    "chunk_id": s.chunk_id,
                    "chunk_index": s.chunk_index,
                    "content": s.content,
                    "score": s.score,
                }
                for s in sources
            ],
            "retrieval_mode": payload.mode,
            "provider": settings.llm_provider,
            "model": settings.llm_model,
        })
        yield f"event: sources\ndata: {sources_data}\n\n"

        # 2. Stream tokens from the LLM provider
        collected_tokens: list[str] = []
        try:
            for token in llm.stream_grounded_answer(question, sources):
                collected_tokens.append(token)
                yield f"event: token\ndata: {json.dumps({'delta': token})}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"
            return

        # 3. Send final done event with total latency and complete synthesized answer
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        done_data = json.dumps({
            "latency_ms": latency_ms,
            "answer": "".join(collected_tokens),
        })
        yield f"event: done\ndata: {done_data}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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
    settings = get_settings()

    question = (
        guard_prompt_query(payload.question)
        if settings.prompt_guard_enabled
        else payload.question
    )

    return retrieve_chunks(
        db,
        project_id=project_id,
        query=question,
        top_k=payload.top_k,
        mode=payload.mode,
    )

