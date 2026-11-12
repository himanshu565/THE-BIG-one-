from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config.settings import get_settings
from app.core.sanitizer import (
    sanitize_filename,
    validate_file_content_signature,
    validate_file_extension,
)
from app.db.database import get_db
from app.models.user import User
from app.repositories import documents, projects
from app.schemas.document import DocumentDetailResponse, DocumentCreate, DocumentResponse
from app.services.ingestion import extract_file_info, ingest_document

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])


def _verify_project_ownership(db: Session, project_id: int, user_id: int) -> None:
    project = projects.get_project(db, project_id=project_id, owner_id=user_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Upload a file to the project, parse it into text chunks, and index it for retrieval."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)

    raw_filename = file.filename or "untitled.txt"

    # 1. Path traversal sanitization
    filename = sanitize_filename(raw_filename)

    # 2. File extension whitelist verification
    try:
        validate_file_extension(filename)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # 3. Size limit verification via chunked streaming read (Anti-DoS / Anti-Memory-Exhaustion)
    settings = get_settings()
    max_bytes = settings.max_upload_size_bytes
    max_mb = max(1, max_bytes // (1024 * 1024))

    # Fast rejection if Content-Length header or file.size is known upfront
    if file.size is not None and file.size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum limit of {max_mb} MB.",
        )

    chunk_buffer: list[bytes] = []
    total_bytes = 0
    read_chunk_size = 64 * 1024  # 64 KB

    while True:
        chunk = await file.read(read_chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file exceeds maximum limit of {max_mb} MB.",
            )
        chunk_buffer.append(chunk)

    raw_bytes = b"".join(chunk_buffer)

    # 4. Content signature and empty payload validation
    try:
        validate_file_content_signature(filename, raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # 5. Extract file content (including real PDF parsing via pypdf)
    try:
        file_type, content = extract_file_info(filename, raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    doc = documents.create_document(
        db,
        project_id=project_id,
        name=filename,
        file_type=file_type,
        file_size=len(raw_bytes),
        content=content,
    )
    ingest_document(db, document=doc, text=content)
    return doc


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    project_id: int,
    payload: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Create a document from raw text content and index its chunks."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)

    filename = sanitize_filename(payload.name)
    try:
        validate_file_extension(filename)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document content cannot be empty.",
        )

    raw_encoded = payload.content.encode("utf-8")
    settings = get_settings()

    if len(raw_encoded) > settings.max_upload_size_bytes:
        max_mb = max(1, settings.max_upload_size_bytes // (1024 * 1024))
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Document content exceeds maximum limit of {max_mb} MB.",
        )

    size = len(raw_encoded)
    doc = documents.create_document(
        db,
        project_id=project_id,
        name=filename,
        file_type=payload.file_type,
        file_size=size,
        content=payload.content,
    )
    ingest_document(db, document=doc, text=payload.content)
    return doc


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    project_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentResponse]:
    """List all documents for an owned project."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)
    return documents.list_documents(db, project_id=project_id, status=status_filter)


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentDetailResponse:
    """Get document details and its indexed chunks."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)

    doc = documents.get_document(db, document_id=document_id, project_id=project_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    chunks = documents.get_document_chunks(db, document_id=doc.id)
    return DocumentDetailResponse(
        id=doc.id,
        project_id=doc.project_id,
        name=doc.name,
        file_type=doc.file_type,
        file_size=doc.file_size,
        status=doc.status,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        chunks=chunks,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete a document and all of its associated chunks."""
    _verify_project_ownership(db, project_id=project_id, user_id=current_user.id)

    deleted = documents.delete_document(db, document_id=document_id, project_id=project_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

