from pydantic import BaseModel, ConfigDict, Field


class QueryRequest(BaseModel):
    """Payload for submitting a question to the project knowledge base."""

    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)
    mode: str = Field(default="hybrid", pattern="^(hybrid|bm25|semantic)$")


class SourceCitation(BaseModel):
    """Information about a retrieved source chunk used in answering the query."""

    model_config = ConfigDict(from_attributes=True)

    document_id: int
    document_name: str
    chunk_id: int
    chunk_index: int
    content: str
    score: float


class QueryResponse(BaseModel):
    """Grounded answer and retrieval citations returned by the RAG engine."""

    question: str
    answer: str
    sources: list[SourceCitation]
    retrieval_mode: str
    provider: str
    model: str
    latency_ms: int

