from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EvaluationCreate(BaseModel):
    """Schema for recording a retrieval evaluation benchmark run."""

    query: str = Field(..., min_length=1, max_length=2000)
    latency_ms: int = Field(..., ge=0)
    chunks_found: int = Field(default=0, ge=0)
    mode: str = Field(default="hybrid", max_length=50)
    status: str = Field(default="Passed", max_length=50)


class EvaluationOut(BaseModel):
    """Public representation of an evaluation benchmark run."""

    id: int
    project_id: int
    query: str
    latency_ms: int
    chunks_found: int
    mode: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
