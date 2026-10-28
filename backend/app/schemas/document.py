from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentCreate(BaseModel):
    """Payload for creating a document with direct text content."""

    name: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    file_type: str = Field(default="txt", max_length=50)


class DocumentChunkResponse(BaseModel):
    """Public representation of an indexed text chunk."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    chunk_index: int
    content: str
    token_count: int
    created_at: datetime


class DocumentResponse(BaseModel):
    """Public document summary representation."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(DocumentResponse):
    """Document representation including its individual text chunks."""

    chunks: list[DocumentChunkResponse] = []

