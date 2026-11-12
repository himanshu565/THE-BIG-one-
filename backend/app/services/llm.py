from abc import ABC, abstractmethod
import httpx

from app.config.settings import get_settings
from app.schemas.query import SourceCitation


class BaseLLMProvider(ABC):
    """Abstract interface for LLM synthesis providers."""

    def format_grounded_prompt(
        self,
        question: str,
        sources: list[SourceCitation],
    ) -> tuple[str, str]:
        """Generate structured system and user prompts for strictly grounded retrieval synthesis."""
        system_prompt = (
            "You are Vectorly, an enterprise RAG assistant. You must answer the user's question "
            "accurately, objectively, and strictly based on the provided source excerpts.\n"
            "Rules:\n"
            "1. Answer ONLY using the facts present in the provided sources. Do not extrapolate or hallucinate.\n"
            "2. If the sources do not contain enough information to answer the question, state: "
            "'I could not find sufficient information in the indexed documents to answer this question.'\n"
            "3. Always cite the document name and chunk index when referencing facts "
            "(e.g., [document_name · chunk X]).\n"
            "4. Be concise, direct, and factual."
        )

        source_blocks: list[str] = []
        for i, s in enumerate(sources, 1):
            source_blocks.append(
                f"[Source {i}] Document: {s.document_name} (Chunk {s.chunk_index})\n"
                f"{s.content.strip()}"
            )

        sources_text = "\n\n---\n\n".join(source_blocks)
        user_prompt = (
            f"Indexed Sources:\n"
            f"----------------\n"
            f"{sources_text}\n"
            f"----------------\n\n"
            f"User Question: {question}\n\n"
            f"Grounded Answer (with citations):"
        )
        return system_prompt, user_prompt

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


class OpenAILLMProvider(BaseLLMProvider):
    """Provider for OpenAI Chat Completions API (gpt-4o, gpt-4o-mini, etc.)."""

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini",
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.api_base = api_base.rstrip("/")
        self.model = model if model != "local-development" else "gpt-4o-mini"
        self.timeout = timeout

    def generate_grounded_answer(
        self,
        question: str,
        sources: list[SourceCitation],
    ) -> str:
        if not sources:
            return (
                f"I could not find sufficient information in the indexed documents "
                f"to answer: '{question}'."
            )

        system_prompt, user_prompt = self.format_grounded_prompt(question, sources)
        url = f"{self.api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 1024,
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code == 401:
                raise RuntimeError("OpenAI authentication failed. Please verify your OPENAI_API_KEY.")
            if response.status_code == 429:
                raise RuntimeError("OpenAI rate limit exceeded. Please retry later.")
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()


class GeminiLLMProvider(BaseLLMProvider):
    """Provider for Google Gemini REST API (gemini-1.5-flash, gemini-2.0-flash, etc.)."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.model = model if model != "local-development" else "gemini-1.5-flash"
        self.timeout = timeout

    def generate_grounded_answer(
        self,
        question: str,
        sources: list[SourceCitation],
    ) -> str:
        if not sources:
            return (
                f"I could not find sufficient information in the indexed documents "
                f"to answer: '{question}'."
            )

        system_prompt, user_prompt = self.format_grounded_prompt(question, sources)
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024,
            },
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code == 400:
                raise RuntimeError(f"Gemini API bad request: {response.text}")
            if response.status_code in (401, 403):
                raise RuntimeError("Gemini API authentication failed. Please verify your GEMINI_API_KEY.")
            response.raise_for_status()
            data = response.json()
            candidates = data.get("candidates", [])
            if candidates and candidates[0].get("content", {}).get("parts"):
                return candidates[0]["content"]["parts"][0]["text"].strip()
            return "No response generated by Gemini."


class OllamaLLMProvider(BaseLLMProvider):
    """Provider for local Ollama instances (e.g., llama3, mistral, qwen)."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3",
        timeout: float = 45.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model if model != "local-development" else "llama3"
        self.timeout = timeout

    def generate_grounded_answer(
        self,
        question: str,
        sources: list[SourceCitation],
    ) -> str:
        if not sources:
            return (
                f"I could not find sufficient information in the indexed documents "
                f"to answer: '{question}'."
            )

        system_prompt, user_prompt = self.format_grounded_prompt(question, sources)
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": 0.1},
        }

        with httpx.Client(timeout=self.timeout) as client:
            try:
                response = client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "").strip()
            except httpx.ConnectError as exc:
                raise RuntimeError(
                    f"Could not connect to Ollama daemon at {self.base_url}. Ensure Ollama is running."
                ) from exc


def get_llm_provider() -> BaseLLMProvider:
    """Factory to instantiate the configured LLM provider."""
    settings = get_settings()
    provider_name = settings.llm_provider.lower().strip()

    if provider_name == "openai":
        if not settings.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required when LLM_PROVIDER is 'openai'."
            )
        return OpenAILLMProvider(
            api_key=settings.openai_api_key,
            api_base=settings.openai_api_base,
            model=settings.llm_model,
        )

    if provider_name == "gemini":
        if not settings.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable is required when LLM_PROVIDER is 'gemini'."
            )
        return GeminiLLMProvider(
            api_key=settings.gemini_api_key,
            model=settings.llm_model,
        )

    if provider_name == "ollama":
        return OllamaLLMProvider(
            base_url=settings.ollama_base_url,
            model=settings.llm_model,
        )

    # Default fallback for testing and development
    return MockLLMProvider()
