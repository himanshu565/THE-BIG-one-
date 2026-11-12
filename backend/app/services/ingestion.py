import io
import re
from sqlalchemy.orm import Session
import pypdf

from app.models.document import Document, DocumentChunk


def estimate_tokens(text: str) -> int:
    """Provide a standard token count estimate based on word and character counts."""
    words = len(text.split())
    char_estimate = len(text) // 4
    return max(1, max(words, char_estimate))


def _extract_overlap_seed(text: str, max_overlap: int) -> str:
    """Extract up to max_overlap trailing characters from text, snapped to sentence/word boundary."""
    if not text or max_overlap <= 0:
        return ""
    if len(text) <= max_overlap:
        return text
    tail = text[-max_overlap:].strip()
    # Snap to the first sentence boundary if available
    sentence_match = re.search(r"[.!?]\s+(.+)$", tail)
    if sentence_match:
        return sentence_match.group(1).strip()
    # Otherwise snap to the first whitespace boundary
    space_idx = tail.find(" ")
    if space_idx != -1 and space_idx < len(tail) - 1:
        return tail[space_idx + 1:].strip()
    return tail


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks, respecting paragraph and sentence boundaries."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    # Ensure chunk_overlap is strictly less than chunk_size
    chunk_overlap = max(0, min(chunk_overlap, chunk_size // 2))

    # Split by double newlines first (paragraphs), then single newlines
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        p_len = len(paragraph)
        if current_len + p_len + (2 if current_chunk else 0) <= chunk_size:
            current_chunk.append(paragraph)
            current_len += p_len + (2 if len(current_chunk) > 1 else 0)
        else:
            overlap_seed = ""
            if current_chunk:
                joined = "\n\n".join(current_chunk).strip()
                if joined and (not chunks or joined != chunks[-1]):
                    chunks.append(joined)
                    if chunk_overlap > 0:
                        overlap_seed = _extract_overlap_seed(joined, chunk_overlap)

            # If paragraph itself is larger than chunk_size, split by sliding window
            if p_len > chunk_size:
                step = max(1, chunk_size - chunk_overlap)
                for i in range(0, p_len, step):
                    sub = paragraph[i : i + chunk_size].strip()
                    if sub and (not chunks or sub != chunks[-1]):
                        chunks.append(sub)
                current_chunk = []
                current_len = 0
            else:
                if overlap_seed and (len(overlap_seed) + p_len + 2 <= chunk_size):
                    current_chunk = [overlap_seed, paragraph]
                    current_len = len(overlap_seed) + p_len + 2
                else:
                    current_chunk = [paragraph]
                    current_len = p_len

    if current_chunk:
        joined = "\n\n".join(current_chunk).strip()
        if joined and (not chunks or joined != chunks[-1]):
            chunks.append(joined)

    return chunks if chunks else [text]


def extract_pdf_text(raw_bytes: bytes) -> str:
    """Extract text from PDF raw bytes using pypdf.

    Raises ValueError if PDF is invalid, corrupted, or encrypted.
    """
    try:
        reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise ValueError(f"Failed to parse PDF document: {exc}") from exc

    if reader.is_encrypted:
        try:
            # Attempt blank password decryption (standard for un-passworded encrypted PDFs)
            result = reader.decrypt("")
            if result == 0:
                raise ValueError("PDF document is encrypted and password-protected.")
        except Exception as exc:
            raise ValueError(f"PDF document is encrypted and cannot be parsed: {exc}") from exc

    pages_text: list[str] = []
    for page_idx, page in enumerate(reader.pages):
        try:
            extracted = page.extract_text() or ""
            extracted = extracted.strip()
            if extracted:
                pages_text.append(f"--- Page {page_idx + 1} ---\n{extracted}")
        except Exception as exc:
            pages_text.append(f"--- Page {page_idx + 1} ---\n[Text extraction error: {exc}]")

    combined = "\n\n".join(pages_text).strip()
    if not combined:
        return (
            "[PDF Document: No extractable text found. "
            "Document may contain scanned images without OCR.]"
        )
    return combined


def extract_file_info(filename: str, raw_bytes: bytes) -> tuple[str, str]:
    """Extract format extension and plaintext content from raw file bytes."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    if ext == "pdf":
        content = extract_pdf_text(raw_bytes)
        return ext, content

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
