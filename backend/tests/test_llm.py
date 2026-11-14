import pytest
from unittest.mock import MagicMock, patch

from app.config.settings import Settings
from app.schemas.query import SourceCitation
from app.services.llm import (
    BaseLLMProvider,
    GeminiLLMProvider,
    MockLLMProvider,
    OllamaLLMProvider,
    OpenAILLMProvider,
    get_llm_provider,
)


@pytest.fixture
def sample_sources() -> list[SourceCitation]:
    return [
        SourceCitation(
            document_id=1,
            document_name="architecture.md",
            chunk_id=10,
            chunk_index=0,
            content="Vectorly utilizes HNSW indexing for sub-100ms vector retrieval.",
            score=0.95,
        ),
        SourceCitation(
            document_id=2,
            document_name="slos.md",
            chunk_id=20,
            chunk_index=1,
            content="Groundedness SLA target is 98 percent across production endpoints.",
            score=0.88,
        ),
    ]


def test_mock_llm_provider(sample_sources: list[SourceCitation]) -> None:
    provider = MockLLMProvider()
    # 1. With sources
    answer = provider.generate_grounded_answer("What is the vector index?", sample_sources)
    assert "[architecture.md · chunk 0]" in answer
    assert "HNSW indexing" in answer
    assert "slos.md" in answer

    # 2. Empty sources
    empty_answer = provider.generate_grounded_answer("Unknown topic", [])
    assert "could not find any relevant information" in empty_answer


def test_base_llm_provider_prompt_formatting(sample_sources: list[SourceCitation]) -> None:
    provider = MockLLMProvider()
    sys_prompt, user_prompt = provider.format_grounded_prompt("What is the SLA?", sample_sources)

    assert "You are Vectorly" in sys_prompt
    assert "architecture.md (Chunk 0)" in user_prompt
    assert "slos.md (Chunk 1)" in user_prompt
    assert "User Question: What is the SLA?" in user_prompt


def test_openai_llm_provider(sample_sources: list[SourceCitation]) -> None:
    provider = OpenAILLMProvider(api_key="sk-test-key", model="gpt-4o-mini")

    # Empty sources early exit
    assert "could not find sufficient information" in provider.generate_grounded_answer("question", [])

    # Mock HTTP response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "The grounded answer based on architecture.md."}}]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        answer = provider.generate_grounded_answer("What is the index?", sample_sources)
        assert answer == "The grounded answer based on architecture.md."
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert "https://api.openai.com/v1/chat/completions" in args[0]
        assert kwargs["headers"]["Authorization"] == "Bearer sk-test-key"


def test_gemini_llm_provider(sample_sources: list[SourceCitation]) -> None:
    provider = GeminiLLMProvider(api_key="gemini-test-key", model="gemini-1.5-flash")

    assert "could not find sufficient information" in provider.generate_grounded_answer("question", [])

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Gemini grounded answer."}]}}]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        answer = provider.generate_grounded_answer("Question", sample_sources)
        assert answer == "Gemini grounded answer."
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert "key=gemini-test-key" in args[0]


def test_ollama_llm_provider(sample_sources: list[SourceCitation]) -> None:
    provider = OllamaLLMProvider(base_url="http://localhost:11434", model="llama3")

    assert "could not find sufficient information" in provider.generate_grounded_answer("question", [])

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "message": {"content": "Ollama local model answer."}
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        answer = provider.generate_grounded_answer("Question", sample_sources)
        assert answer == "Ollama local model answer."
        mock_post.assert_called_once()


def test_get_llm_provider_factory() -> None:
    # 1. Mock provider
    with patch("app.services.llm.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(llm_provider="mock")
        p = get_llm_provider()
        assert isinstance(p, MockLLMProvider)

    # 2. OpenAI provider without key raises ValueError
    with patch("app.services.llm.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(llm_provider="openai", openai_api_key=None)
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            get_llm_provider()

    # 3. OpenAI provider with key
    with patch("app.services.llm.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            llm_provider="openai",
            openai_api_key="sk-test",
            openai_api_base="https://api.openai.com/v1",
            llm_model="gpt-4o-mini",
        )
        p = get_llm_provider()
        assert isinstance(p, OpenAILLMProvider)

    # 4. Gemini provider without key raises ValueError
    with patch("app.services.llm.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(llm_provider="gemini", gemini_api_key=None)
        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            get_llm_provider()

    # 5. Gemini provider with key
    with patch("app.services.llm.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            llm_provider="gemini",
            gemini_api_key="gem-test",
            llm_model="gemini-1.5-flash",
        )
        p = get_llm_provider()
        assert isinstance(p, GeminiLLMProvider)

    # 6. Ollama provider
    with patch("app.services.llm.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            llm_provider="ollama",
            ollama_base_url="http://localhost:11434",
            llm_model="llama3",
        )
        p = get_llm_provider()
        assert isinstance(p, OllamaLLMProvider)
