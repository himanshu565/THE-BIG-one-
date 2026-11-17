import math
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.config.settings import get_settings
from app.services.embedding import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    LocalEmbeddingProvider,
    OllamaEmbeddingProvider,
    OpenAIEmbeddingProvider,
    cosine_similarity,
    get_embedding_provider,
)


def test_cosine_similarity_edge_cases() -> None:
    # Identical vectors
    v1 = [1.0, 0.0, 0.0]
    assert cosine_similarity(v1, v1) == 1.0

    # Orthogonal vectors
    v2 = [0.0, 1.0, 0.0]
    assert cosine_similarity(v1, v2) == 0.0

    # Opposite vectors
    v3 = [-1.0, 0.0, 0.0]
    assert cosine_similarity(v1, v3) == -1.0

    # Zero / empty vectors
    assert cosine_similarity([], []) == 0.0
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0
    assert cosine_similarity([1.0], [1.0, 2.0]) == 0.0


def test_local_embedding_provider_determinism_and_norm() -> None:
    provider = LocalEmbeddingProvider(dimensions=256)
    assert provider.dimensions == 256

    text = "Vectorly high performance hybrid retrieval engine"
    vec1 = provider.embed_text(text)
    vec2 = provider.embed_text(text)

    assert len(vec1) == 256
    assert vec1 == vec2  # Must be strictly deterministic

    # Verify L2 unit normalization
    norm = math.sqrt(sum(x * x for x in vec1))
    assert math.isclose(norm, 1.0, rel_tol=1e-3)

    # Different text yields distinct vector with similarity < 1.0
    different_text = "Completely unrelated culinary recipe for pasta"
    diff_vec = provider.embed_text(different_text)
    sim = cosine_similarity(vec1, diff_vec)
    assert sim < 0.9

    # Partial synonym / word overlap yields positive similarity
    partial_text = "Vectorly hybrid retrieval pipeline"
    partial_vec = provider.embed_text(partial_text)
    partial_sim = cosine_similarity(vec1, partial_vec)
    assert partial_sim > 0.3

    # Empty text
    empty_vec = provider.embed_text("")
    assert empty_vec == [0.0] * 256

    # Batch embedding
    batch = provider.embed_texts([text, different_text])
    assert len(batch) == 2
    assert batch[0] == vec1
    assert batch[1] == diff_vec


def test_openai_embedding_provider_mocked() -> None:
    fake_dim = 1536
    fake_embedding = [0.05] * fake_dim
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": [{"index": 0, "embedding": fake_embedding}]
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp) as mock_post:
        provider = OpenAIEmbeddingProvider(
            api_key="sk-test-fake-key",
            model="text-embedding-3-small",
            dimensions=fake_dim,
        )
        assert provider.dimensions == fake_dim

        res = provider.embed_texts(["hello world"])
        assert len(res) == 1
        assert res[0] == fake_embedding
        assert mock_post.called

        # Verify 401 error
        mock_resp.status_code = 401
        with pytest.raises(RuntimeError, match="OpenAI authentication failed"):
            provider.embed_texts(["test fail"])


def test_gemini_embedding_provider_mocked() -> None:
    fake_dim = 768
    fake_embedding = [0.02] * fake_dim
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "embeddings": [{"values": fake_embedding}]
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp) as mock_post:
        provider = GeminiEmbeddingProvider(
            api_key="fake-gemini-key",
            model="text-embedding-004",
            dimensions=fake_dim,
        )
        assert provider.dimensions == fake_dim

        res = provider.embed_texts(["gemini test"])
        assert len(res) == 1
        assert res[0] == fake_embedding
        assert mock_post.called


def test_ollama_embedding_provider_mocked() -> None:
    fake_dim = 768
    fake_embedding = [0.03] * fake_dim
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "embeddings": [fake_embedding]
    }

    with patch.object(httpx.Client, "post", return_value=mock_resp):
        provider = OllamaEmbeddingProvider(
            base_url="http://localhost:11434",
            model="nomic-embed-text",
            dimensions=fake_dim,
        )
        assert provider.dimensions == fake_dim

        res = provider.embed_texts(["ollama test"])
        assert len(res) == 1
        assert res[0] == fake_embedding


def test_get_embedding_provider_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    # Default local
    settings = get_settings()
    monkeypatch.setattr(settings, "embedding_provider", "local")
    provider = get_embedding_provider()
    assert isinstance(provider, LocalEmbeddingProvider)

    # OpenAI without key raises ValueError
    monkeypatch.setattr(settings, "embedding_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", None)
    with pytest.raises(ValueError, match="OPENAI_API_KEY environment variable is required"):
        get_embedding_provider()

    # Gemini without key raises ValueError
    monkeypatch.setattr(settings, "embedding_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", None)
    with pytest.raises(ValueError, match="GEMINI_API_KEY environment variable is required"):
        get_embedding_provider()

    # Ollama provider
    monkeypatch.setattr(settings, "embedding_provider", "ollama")
    ollama_provider = get_embedding_provider()
    assert isinstance(ollama_provider, OllamaEmbeddingProvider)
