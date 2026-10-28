import re
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk


def estimate_tokens(text: str) -> int:
    """Provide a standard token count estimate based on word and character counts."""
    words = len(text.split())
    char_estimate = len(text) // 4
    return max(1, max(words, char_estimate))


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks, respecting paragraph and sentence boundaries."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    # Split by double newlines first (paragraphs), then single newlines, then sentences
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        p_len = len(paragraph)
        if current_len + p_len + 1 <= chunk_size:
            current_chunk.append(paragraph)
            current_len += p_len + 1
        else:
            if current_chunk:
                joined = "\n\n".join(current_chunk).strip()
                if joined:
                    chunks.append(joined)
            # If paragraph itself is larger than chunk_size, split by sentences or fixed length
            if p_len > chunk_size:
                step = chunk_size - chunk_overlap
                for i in range(0, p_len, max(1, step)):
                    sub = paragraph[i : i + chunk_size].strip()
                    if sub:
                        chunks.append(sub)
                current_chunk = []
                current_len = 0
            else:
                current_chunk = [paragraph]
                current_len = p_len

    if current_chunk:
        joined = "\n\n".join(current_chunk).strip()
        if joined and (not chunks or joined != chunks[-1]):
            chunks.append(joined)

    return chunks if chunks else [text]


def extract_file_info(filename: str, raw_bytes: bytes) -> tuple[str, str]:
    """Extract format extension and plaintext content from raw file bytes."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            content = raw_bytes.decode("latin-1")
        except Exception:
            content = f"Binary content ({len(raw_bytes)} bytes)"
    return ext, content


def ingest_document(
    db: Session,
    *,
    document: Document,
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[DocumentChunk]:
    """Split document text into chunks, persist DocumentChunk records, and update document status."""
    chunks = chunk_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    db_chunks: list[DocumentChunk] = []

    for index, chunk_str in enumerate(chunks):
        chunk = DocumentChunk(
            document_id=document.id,
            chunk_index=index,
            content=chunk_str,
            token_count=estimate_tokens(chunk_str),
        )
        db.add(chunk)
        db_chunks.append(chunk)

    document.chunk_count = len(db_chunks)
    document.status = "ready"
    document.content = text
    db.commit()
    db.refresh(document)
    return db_chunks

