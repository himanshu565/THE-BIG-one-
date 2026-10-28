from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.database import Base
from app.models.document import Document
from app.models.project import Project
from app.models.user import User
from app.services.ingestion import chunk_text, estimate_tokens, extract_file_info, ingest_document


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_chunk_text_empty_and_short() -> None:
    assert chunk_text("") == []
    assert chunk_text("Hello world") == ["Hello world"]


def test_chunk_text_splits_paragraphs() -> None:
    text = "Paragraph 1 with some content.\n\nParagraph 2 with different content.\n\nParagraph 3."
    chunks = chunk_text(text, chunk_size=50, chunk_overlap=10)
    assert len(chunks) >= 2
    assert "Paragraph 1 with some content." in chunks[0]


def test_estimate_tokens() -> None:
    tokens = estimate_tokens("The quick brown fox jumps over the lazy dog.")
    assert tokens >= 9


def test_extract_file_info() -> None:
    ext, text = extract_file_info("architecture.md", b"# Architecture\n\nMicroservices overview")
    assert ext == "md"
    assert "Microservices" in text


def test_ingest_document(db_session: Session) -> None:
    user = User(email="author@vectorly.ai", hashed_password="pw")
    db_session.add(user)
    db_session.commit()

    proj = Project(name="Docs", owner_id=user.id)
    db_session.add(proj)
    db_session.commit()

    doc = Document(
        project_id=proj.id,
        name="guide.txt",
        file_type="txt",
        file_size=100,
        status="processing",
    )
    db_session.add(doc)
    db_session.commit()

    raw_text = "Section 1: Setup\n\nRun the installer.\n\nSection 2: Configuration\n\nSet your API keys."
    chunks = ingest_document(db_session, document=doc, text=raw_text)

    assert doc.status == "ready"
    assert doc.chunk_count == len(chunks)
    assert len(chunks) > 0
    assert chunks[0].document_id == doc.id

