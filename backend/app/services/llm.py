from abc import ABC, abstractmethod

from app.config.settings import get_settings
from app.schemas.query import SourceCitation


class BaseLLMProvider(ABC):
    """Abstract interface for LLM synthesis providers."""

    @abstractmethod
    def generate_grounded_answer(
        self,
        question: str,
        sources: list[SourceCitation],
    ) -> str:
        """Generate a grounded answer based strictly on retrieved source chunks."""


class MockLLMProvider(BaseLLMProvider):
    """Deterministic local provider used for development and offline testing."""

    def generate_grounded_answer(
        self,
        question: str,
        sources: list[SourceCitation],
    ) -> str:
        if not sources:
            return (
                f"I could not find any relevant information in your indexed documents "
                f"to answer: '{question}'. Please upload related documentation and try again."
            )

        top_source = sources[0]
        # Clean text snippet from the top source
        preview = " ".join(top_source.content.split()[:40])
        citation = f"[{top_source.document_name} · chunk {top_source.chunk_index}]"

        answer = (
            f"Based on your indexed documents, specifically {citation}, "
            f"the relevant context states: \"{preview}...\". "
            f"This addresses your question regarding '{question}'."
        )
        if len(sources) > 1:
            additional_docs = ", ".join(
                {f"{s.document_name}" for s in sources[1:]}
            )
            answer += f" Additional corroborating context was found in: {additional_docs}."

        return answer


def get_llm_provider() -> BaseLLMProvider:
    """Factory to instantiate the configured LLM provider."""
    settings = get_settings()
    provider_name = settings.llm_provider.lower().strip()
    if provider_name == "mock":
        return MockLLMProvider()
    # Default fallback for testing and development
    return MockLLMProvider()

