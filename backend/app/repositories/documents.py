from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk


def create_document(
    db: Session,
    *,
    project_id: int,
    name: str,
    file_type: str,
    file_size: int,
    content: str | None = None,
    status: str = "processing",
) -> Document:
    """Create and persist a new Document row."""
    doc = Document(
        project_id=project_id,
        name=name,
        file_type=file_type.lower(),
        file_size=file_size,
        content=content,
        status=status,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_documents(
    db: Session,
    *,
    project_id: int,
    status: str | None = None,
) -> list[Document]:
    """Return all documents for a project, optionally filtered by status."""
    query = db.query(Document).filter(Document.project_id == project_id)
    if status is not None:
        query = query.filter(Document.status == status)
    return query.order_by(Document.created_at.desc(), Document.id.desc()).all()


def get_document(
    db: Session,
    *,
    document_id: int,
    project_id: int | None = None,
) -> Document | None:
    """Return a single document by ID, optionally scoped to a project."""
    query = db.query(Document).filter(Document.id == document_id)
    if project_id is not None:
        query = query.filter(Document.project_id == project_id)
    return query.first()


def delete_document(
    db: Session,
    *,
    document_id: int,
    project_id: int | None = None,
) -> bool:
    """Delete a document and its cascading chunks. Return True if deleted."""
    doc = get_document(db, document_id=document_id, project_id=project_id)
    if doc is None:
        return False
    db.delete(doc)
    db.commit()
    return True


def get_document_chunks(db: Session, *, document_id: int) -> list[DocumentChunk]:
    """Return all indexed chunks belonging to a document."""
    return (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
        .all()
    )

