from abc import ABC, abstractmethod
import hashlib
import math
import re
from typing import Any

import httpx

from app.config.settings import get_settings


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two numeric vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    sim = dot / (norm_a * norm_b)
    # Clamp to [-1.0, 1.0] to guard against floating-point rounding
    return round(max(-1.0, min(1.0, sim)), 4)


class BaseEmbeddingProvider(ABC):
    """Abstract interface for dense neural vector embedding providers."""

    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Generate dense vector embeddings for a list of text inputs."""

    def embed_text(self, text: str) -> list[float]:
        """Generate dense vector embedding for a single text input."""
        res = self.embed_texts([text])
        return res[0] if res else []

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return the vector dimensionality produced by this provider."""


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """High-performance, deterministic local embedding provider.
    
    Generates unit-normalized dense vectors (default 256 dimensions) using
    sub-word character n-gram projections and semantic token hashing.
    Enables true dense geometric vector search completely offline with zero API keys.
    """

    def __init__(self, dimensions: int = 256) -> None:
        self._dimensions = max(32, min(dimensions, 1536))

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def _embed_single(self, text: str) -> list[float]:
        text = text.strip()
        if not text:
            return [0.0] * self._dimensions

        vector = [0.0] * self._dimensions

        # Tokenize lowercase alphanumeric terms
        tokens = re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())
        if not tokens:
            return [0.0] * self._dimensions

        for weight_mult, token in enumerate(tokens, 1):
            # 1. Whole token hash
            h_raw = hashlib.sha256(token.encode("utf-8")).digest()
            idx = int.from_bytes(h_raw[:4], "little") % self._dimensions
            sign = 1.0 if (h_raw[4] % 2 == 0) else -1.0
            vector[idx] += sign * (1.0 + 1.0 / weight_mult)

            # 2. Sub-word character 3-grams to capture morphological similarity
            for i in range(len(token) - 2):
                ngram = token[i : i + 3]
                nh_raw = hashlib.md5(ngram.encode("utf-8")).digest()
                n_idx = int.from_bytes(nh_raw[:4], "little") % self._dimensions
                n_sign = 1.0 if (nh_raw[4] % 2 == 0) else -1.0
                vector[n_idx] += n_sign * 0.35

        # Normalize to unit length (L2 norm = 1.0)
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0.0:
            vector = [round(v / norm, 6) for v in vector]
        return vector

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_single(t) for t in texts]


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """Provider for OpenAI Embeddings API (text-embedding-3-small, text-embedding-ada-002)."""

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.openai.com/v1",
        model: str = "text-embedding-3-small",
        dimensions: int = 1536,
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.api_base = api_base.rstrip("/")
        self.model = model
        self._dimensions = dimensions
        self.timeout = timeout

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        url = f"{self.api_base}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "input": texts,
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code == 401:
                raise RuntimeError("OpenAI authentication failed. Please verify your OPENAI_API_KEY.")
            if response.status_code == 429:
                raise RuntimeError("OpenAI rate limit exceeded. Please retry later.")
            response.raise_for_status()
            data = response.json()
            # Sort by index in case API returns out of order
            items = sorted(data.get("data", []), key=lambda x: x.get("index", 0))
            return [item["embedding"] for item in items]


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Provider for Google Gemini Embeddings API (text-embedding-004)."""

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-004",
        dimensions: int = 768,
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self._dimensions = dimensions
        self.timeout = timeout

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:batchEmbedContents?key={self.api_key}"
        )
        headers = {"Content-Type": "application/json"}
        requests_payload = [
            {"model": f"models/{self.model}", "content": {"parts": [{"text": t}]}}
            for t in texts
        ]
        payload = {"requests": requests_payload}

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code in (401, 403):
                raise RuntimeError("Gemini API authentication failed. Please verify your GEMINI_API_KEY.")
            response.raise_for_status()
            data = response.json()
            embeddings_data = data.get("embeddings", [])
            return [e.get("values", []) for e in embeddings_data]


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    """Provider for local Ollama embedding models (e.g. nomic-embed-text, all-minilm)."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "nomic-embed-text",
        dimensions: int = 768,
        timeout: float = 45.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._dimensions = dimensions
        self.timeout = timeout

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        url = f"{self.base_url}/api/embed"
        payload = {
            "model": self.model,
            "input": texts,
        }

        with httpx.Client(timeout=self.timeout) as client:
            try:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    embeddings = data.get("embeddings", [])
                    if embeddings:
                        return embeddings
                
                # Fallback to older /api/embeddings single-prompt endpoint
                results = []
                for t in texts:
                    res = client.post(f"{self.base_url}/api/embeddings", json={"model": self.model, "prompt": t})
                    res.raise_for_status()
                    results.append(res.json().get("embedding", []))
                return results
            except httpx.ConnectError as exc:
                raise RuntimeError(
                    f"Could not connect to Ollama daemon at {self.base_url}. Ensure Ollama is running."
                ) from exc


def get_embedding_provider() -> BaseEmbeddingProvider:
    """Factory to instantiate the configured embedding provider."""
    settings = get_settings()
    provider_name = settings.embedding_provider.lower().strip()

    if provider_name == "openai":
        if not settings.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required when EMBEDDING_PROVIDER is 'openai'."
            )
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            api_base=settings.openai_api_base,
            model=settings.embedding_model if settings.embedding_model != "local-hash-256" else "text-embedding-3-small",
            dimensions=settings.embedding_dimensions,
        )

    if provider_name == "gemini":
        if not settings.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable is required when EMBEDDING_PROVIDER is 'gemini'."
            )
        return GeminiEmbeddingProvider(
            api_key=settings.gemini_api_key,
            model=settings.embedding_model if settings.embedding_model != "local-hash-256" else "text-embedding-004",
            dimensions=settings.embedding_dimensions,
        )

    if provider_name == "ollama":
        return OllamaEmbeddingProvider(
            base_url=settings.ollama_base_url,
            model=settings.embedding_model if settings.embedding_model != "local-hash-256" else "nomic-embed-text",
            dimensions=settings.embedding_dimensions,
        )

    # Default robust local provider (zero API keys required, 100% offline)
    return LocalEmbeddingProvider(dimensions=settings.embedding_dimensions)
