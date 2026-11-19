# Vectorly Backend Learner Guide

This guide explains the current backend implementation as if you are learning the
project from the beginning. It describes not only what the code does, but also why
each design decision was made, what trade-offs it creates, and how the system should
evolve.

## 1. What we are building

Vectorly is a retrieval-aware AI infrastructure platform. Its responsibilities
include:

- authenticating users and managing workspaces;
- organizing users' work into user-owned projects;
- storing, processing, and chunking documents;
- answering questions using hybrid retrieval (BM25 + semantic similarity with RRF) and grounded LLM synthesis;
- evaluating retrieval quality;
- tracking activity and workspace settings.

The backend exposes:

```text
GET    /health

POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}

POST   /api/v1/projects/{project_id}/documents/upload
POST   /api/v1/projects/{project_id}/documents
GET    /api/v1/projects/{project_id}/documents
GET    /api/v1/projects/{project_id}/documents/{document_id}
DELETE /api/v1/projects/{project_id}/documents/{document_id}

POST   /api/v1/projects/{project_id}/query
POST   /api/v1/projects/{project_id}/query/stream
POST   /api/v1/projects/{project_id}/search

POST   /api/v1/projects/{project_id}/evaluations
GET    /api/v1/projects/{project_id}/evaluations?limit=50&offset=0
```

## 2. System design approach

The backend follows a layered architecture:

```text
HTTP request (with Bearer token)
    |
    v
FastAPI router & dependencies (get_db, get_current_user)
    |  validates token, parses inputs, enforces authentication & project ownership
    v
RAG Pipeline (app/services/retrieval.py, app/services/llm.py)
    |  BM25 ranking + Semantic ranking -> Reciprocal Rank Fusion (RRF) -> LLM answer synthesis
    v
Pydantic schemas
    |  defines request & response contracts
    v
Repository functions
    |  contains database operations scoped to owner
    v
SQLAlchemy models (User, Project, Document, DocumentChunk)
    |  maps Python objects to database rows
    v
PostgreSQL / SQLite database (managed via Alembic migrations)
```

## 3. Why this technology stack was chosen

### Hybrid Retrieval & Reciprocal Rank Fusion (RRF)

- **Okapi BM25** delivers high precision on exact keywords, identifiers, and domain-specific terms.
- **Semantic Vector Ranking** captures conceptual similarities even when phrasing differs.
- **RRF (Reciprocal Rank Fusion)** merges both ranked lists into a stable, non-parametric unified ranking without requiring complex hyperparameter tuning.

### Pluggable LLM Provider Abstraction

- Abstract `BaseLLMProvider` decouples the API and retrieval pipeline from specific LLM vendors.
- Supported providers via `LLM_PROVIDER`:
  - `MockLLMProvider`: Deterministic grounded answers with citations during development and automated tests.
  - `OpenAILLMProvider`: Direct OpenAI Chat Completions API integration (`gpt-4o-mini`, `gpt-4o`) via `httpx`.
  - `GeminiLLMProvider`: Google Gemini REST API integration (`gemini-1.5-flash`) via `httpx`.
  - `OllamaLLMProvider`: Local Ollama integration (`llama3`, `mistral`) via `httpx`.
- `get_llm_provider()` factory dynamically configures and validates required API credentials.

### Ingestion & Chunking Hardening

- **Real PDF Ingestion**: Integrated `pypdf` with encrypted document detection and page-by-page text extraction.
- **Multi-Paragraph Chunk Overlap**: Sentence and whitespace-boundary overlap seeding (`_extract_overlap_seed()`) preserves context continuity across paragraph breaks.
- **Magic Byte & Content Signature Validation**: Inspects initial byte signatures (`%PDF-`, `MZ`, `ELF`, Mach-O, null bytes) to reject disguised executables or malformed files.

### Multi-Layered Anti-Hack Security Architecture

- **OWASP Security Headers**: Enforces HSTS, Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy` to block clickjacking, MIME confusion, and XSS.
- **Sliding-Window Rate Limiting**: Throttles requests per client IP across tiered thresholds (20/min for auth, 60/min for queries/uploads, 300/min global) with `HTTP 429` and `Retry-After` to prevent brute-force attacks and DoS.
- **File Ingestion Firewall**: Limits uploads to 10 MB (`HTTP 413`), fast header rejection, enforces strict extension whitelisting (`.txt, .md, .pdf, .csv`), and strips directory traversal markers (`Path.name`).
- **Prompt Injection & Adversarial Guard**: Sanitizes adversarial jailbreak phrases and system prompt overrides (`### System:`, `[INST]`, `Ignore previous instructions`) before retrieval and synthesis.
- **Hardened CORS Policy**: Scopes cross-origin resource sharing to designated frontend origins with explicit credential checks.

## 4. Project structure

```text
backend/
├── alembic/
│   ├── versions/             # Migration scripts
│   └── env.py                # Alembic environment runner
├── alembic.ini               # Migration configuration
├── app/
│   ├── api/
│   │   ├── auth.py           # Registration and login endpoints
│   │   ├── deps.py           # Dependency injection (get_current_user)
│   │   ├── documents.py      # Document upload and retrieval endpoints
│   │   ├── evaluations.py    # Persistent retrieval benchmark endpoints
│   │   ├── projects.py       # Authenticated project CRUD endpoints
│   │   └── retrieval.py      # Hybrid RAG query and search endpoints
│   ├── config/
│   │   └── settings.py       # Environment-backed application settings
│   ├── core/
│   │   ├── logging.py        # Structured JSON logger & X-Request-ID middleware
│   │   ├── rate_limit.py     # Sliding-window rate limiting middleware
│   │   ├── sanitizer.py      # Path traversal, XSS, and prompt injection filters
│   │   ├── security.py       # Password hashing & JWT generation/decoding
│   │   └── security_headers.py # OWASP defensive security headers middleware
│   ├── db/
│   │   └── database.py       # SQLAlchemy engine, Base, and session dependency
│   ├── models/
│   │   ├── document.py       # Document and DocumentChunk table mappings
│   │   ├── evaluation.py     # EvaluationRun table mapping
│   │   ├── project.py        # Project table mapping
│   │   └── user.py           # User table mapping
│   ├── repositories/
│   │   ├── documents.py      # Document persistence operations
│   │   ├── evaluations.py    # Benchmark evaluation persistence operations
│   │   ├── projects.py       # Project persistence operations (owner scoped)
│   │   └── users.py          # User persistence operations
│   ├── schemas/
│   │   ├── document.py       # Document request and response contracts
│   │   ├── evaluation.py     # Evaluation benchmark schemas
│   │   ├── project.py        # Project request and response contracts
│   │   ├── query.py          # Query request, response, and citation schemas
│   │   └── user.py           # Auth request and response contracts
│   ├── scripts/
│   │   └── seed.py           # Automated database seeder CLI
│   ├── services/
│   │   ├── embedding.py      # Dense neural embedding providers (Local, OpenAI, Gemini, Ollama)
│   │   ├── ingestion.py      # Text extraction, chunking, and vector embedding pipeline
│   │   ├── llm.py            # LLM provider interface and implementations
│   │   └── retrieval.py      # BM25, dense vector cosine similarity, and RRF ranker
│   └── main.py               # FastAPI application composition
├── tests/
│   ├── test_auth_api.py
│   ├── test_documents_api.py
│   ├── test_embedding.py
│   ├── test_evaluations_api.py
│   ├── test_health.py
│   ├── test_ingestion.py
│   ├── test_llm.py
│   ├── test_migrations.py
│   ├── test_projects_api.py
│   ├── test_projects_repository.py
│   ├── test_retrieval.py
│   ├── test_security.py
│   ├── test_seed.py
│   ├── test_settings.py
│   └── test_users_repository.py
├── Dockerfile                # Production multi-stage backend container
├── entrypoint.sh             # Container startup entrypoint (migrations & seeding)
├── .dockerignore             # Docker build context exclusions
└── requirements.txt
```

## 5. File-by-file explanation

### `app/services/embedding.py`

- `BaseEmbeddingProvider`: abstract interface for dense vector embedding generation.
- `LocalEmbeddingProvider`: zero-config offline 256-dim unit-normalized sub-word & token embedder.
- `OpenAIEmbeddingProvider`, `GeminiEmbeddingProvider`, `OllamaEmbeddingProvider`: cloud and local neural embedding clients.
- `cosine_similarity(vec_a, vec_b)`: exact geometric cosine similarity between dense float vectors.

### `app/services/retrieval.py`

- `bm25_rank(query_tokens, corpus_tokens)`: calculates Okapi BM25 scores with document length normalization.
- `dense_vector_rank(query_embedding, corpus_embeddings)`: calculates geometric cosine similarity against stored chunk embeddings.
- `reciprocal_rank_fusion(bm25_order, semantic_order, total_docs)`: combines both rankings using standard RRF ($k=60$).
- `retrieve_chunks(db, project_id, query, top_k, mode)`: executes ranking and returns structured `SourceCitation` models.

### `app/services/llm.py`

- `generate_grounded_answer(question, sources)`: produces an answer synthesizing context from the top retrieved chunks with explicit citation references.
- `stream_grounded_answer(question, sources)`: yields progressive tokens from the configured provider (Mock, OpenAI, Gemini, Ollama) for real-time streaming.

### `app/api/retrieval.py`

- `POST /api/v1/projects/{project_id}/query`: verifies project ownership, retrieves source chunks, generates grounded answer, and measures execution latency.
- `POST /api/v1/projects/{project_id}/query/stream`: streams grounded answer tokens via Server-Sent Events (SSE) with unbuffered transmission (`X-Accel-Buffering: no`).
- `POST /api/v1/projects/{project_id}/search`: retrieves ranked source chunks without LLM synthesis.

### `app/scripts/seed.py`

- `seed_database(db, reset, verbose)`: CLI tool populating enterprise users, demo projects, markdown documents, vectorized chunks, and evaluations.

## 6. Recommended next design steps

The roadmap phases status:

1. [COMPLETED] Add authentication and derive the owner from the authenticated principal.
2. [COMPLETED] Add Alembic migrations and a safe database startup/deployment process.
3. [COMPLETED] Add documents domain with project foreign key, upload endpoint, and chunking pipeline.
4. [COMPLETED] Add retrieval/query APIs behind an LLM-provider abstraction (hybrid BM25 + vector search preview).
5. [COMPLETED] Add frontend integration connecting `app/page.tsx` views to the backend API.
6. [COMPLETED] Add readiness health probes (`GET /health` with `SELECT 1` pool verification), structured JSON logging, and request correlation IDs (`X-Request-ID`).
7. [COMPLETED] Add multi-instance anti-hack protections (trusted proxy IP spoofing defense, production secret safety gating).
8. [COMPLETED] Containerization (`Dockerfile`, `docker-compose.yml`) and automated CI/CD pipeline (`.github/workflows/ci.yml`).
9. [COMPLETED] Persistent evaluations domain, live latency telemetry, and limit/offset query pagination.
10. [COMPLETED] Production database seeder CLI (`seed.py`) with reset and quiet flags.
11. [COMPLETED] True dense neural embeddings (`Local`, `OpenAI`, `Gemini`, `Ollama`) stored on `document_chunks` and integrated into Hybrid RRF retrieval.
12. [COMPLETED] Real-Time Streaming RAG (`POST /query/stream`) via Server-Sent Events (SSE) with progressive UI rendering and user cancellation.

## 7. How to run tests

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```

All 78 backend tests verify project CRUD, auth, ingestion, dense neural embeddings, real-time SSE streaming, LLM providers, migrations, security headers, rate limiting, evaluations domain, database seeding, and readiness probes.
