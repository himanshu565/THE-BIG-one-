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

- **Okapi BM25** delivers high precision on exact keywords, identifiers, and domain-specific terms (e.g. error codes like `ERR_HTTP2_RESET` or product SKUs):
  $$\text{IDF}(q_i) = \ln\left(\frac{N - n(q_i) + 0.5}{n(q_i) + 0.5} + 1\right)$$
  $$\text{BM25 Score} = \sum_{i} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$
  where $k_1 = 1.5$ (term frequency saturation) and $b = 0.75$ (document length penalty).
- **Semantic Vector Ranking** captures conceptual similarities even when phrasing differs (e.g. matching "container crashing" with "Kubernetes pods failing") using exact geometric cosine similarity:
  $$\text{Cosine Similarity}(\mathbf{u}, \mathbf{v}) = \max\left(-1.0, \min\left(1.0, \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}\right)\right)$$
- **RRF (Reciprocal Rank Fusion)** merges both ranked lists into a stable, non-parametric unified ranking without requiring manual score calibration:
  $$\text{RRF Score}(d) = \sum_{m \in \{\text{BM25}, \text{Semantic}\}} \frac{1}{60 + r_m(d)}$$
  Operating on ranks ($r_m(d) \in \{1, 2, \dots\}$) guarantees that top hits in either search modality surface at the top.

### Pluggable Dense Neural Embeddings & Vector Storage

- Abstract `BaseEmbeddingProvider` in `app/services/embedding.py` decouples the retrieval engine from specific embedding models.
- **`LocalEmbeddingProvider`** (Default, zero API key required):
  - Generates deterministic 256-dimensional unit-normalized float vectors using a signed hash projection over whole-word tokens and character 3-grams (capturing morphological variants like "retrieval", "retrieve", "retriever").
  - Enforces strict $L_2$ unit normalization:
    $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2} = \frac{\mathbf{v}}{\sqrt{\sum_{i=1}^{D} v_i^2}}$$
    guaranteeing that vector dot products equal cosine similarities.
- **Enterprise Cloud Providers**:
  - `OpenAIEmbeddingProvider`: Calls `POST /v1/embeddings` (`text-embedding-3-small`, 1536 dims).
  - `GeminiEmbeddingProvider`: Calls `:batchEmbedContents` (`text-embedding-004`, 768 dims).
  - `OllamaEmbeddingProvider`: Calls local `/api/embed` (`nomic-embed-text`).
- **Portable Database Schema**: Embeddings are stored as JSON-serialized text on `document_chunks.embedding`, ensuring full SQLite zero-config portability and clean Alembic upgrade paths to PostgreSQL without requiring native C-compiler extensions.

### Real-Time Server-Sent Events (SSE) Streaming Architecture

- **Unbuffered Transport**: `POST /api/v1/projects/{id}/query/stream` returns `StreamingResponse(..., media_type="text/event-stream")` with `X-Accel-Buffering: no` and `Cache-Control: no-cache` to prevent reverse proxies (Nginx, Traefik, AWS ALB) from buffering chunks.
- **Decoupled Database Sessions (Preventing Connection Pool Starvation)**:
  - Retrieval (`retrieve_chunks`) executes synchronously within the active database dependency context.
  - Source citations are serialized into memory immediately, and the database session dependency closes.
  - The SSE generator runs independently, ensuring that slow LLM token streaming never holds an open database connection idle.
- **Event Protocol Sequence**:
  - `event: sources` — Immediately delivers retrieved citation cards before token generation starts.
  - `event: token` — Progressively yields token deltas (`{"delta": "text"}`).
  - `event: done` — Yields total execution latency and complete answer.
  - `data: [DONE]` — Terminates the SSE stream.

### Pluggable LLM Provider Abstraction

- Abstract `BaseLLMProvider` decouples the API and retrieval pipeline from specific LLM vendors.
- Supported providers via `LLM_PROVIDER`:
  - `MockLLMProvider`: Deterministic grounded answers with citations during development and automated tests.
  - `OpenAILLMProvider`: Direct OpenAI Chat Completions API integration (`gpt-4o-mini`, `gpt-4o`) via `httpx`.
  - `GeminiLLMProvider`: Google Gemini REST API integration (`gemini-1.5-flash`) via `httpx`.
  - `OllamaLLMProvider`: Local Ollama integration (`llama3`, `mistral`) via `httpx`.
- `get_llm_provider()` factory dynamically configures and validates required API credentials.

### Ingestion & Chunking Hardening

- **64KB Chunked Streaming Upload Cap**: Reads incoming files iteratively in 64 KB buffers up to 10 MB (`MAX_UPLOAD_SIZE_BYTES`). Aborts immediately with `HTTP 413` upon exceeding the limit, preventing memory-exhaustion DoS attacks.
- **Real PDF Ingestion**: Integrated `pypdf` with encrypted document detection and page-by-page text extraction.
- **Multi-Paragraph Chunk Overlap**: Sentence and whitespace-boundary overlap seeding (`_extract_overlap_seed()`) preserves context continuity across paragraph breaks.
- **Magic Byte & Content Signature Validation**: Inspects initial byte signatures (`%PDF-`, `MZ`, `ELF`, Mach-O, null bytes) to reject disguised executables or malformed files.

### Multi-Layered Anti-Hack Security Architecture

- **OWASP Security Headers**: Enforces HSTS, Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy` to block clickjacking, MIME confusion, and XSS.
- **Sliding-Window Rate Limiting**: Throttles requests per client IP across tiered thresholds (20/min for auth, 60/min for queries/uploads, 300/min global) with `HTTP 429` and `Retry-After` to prevent brute-force attacks and DoS.
- **Anti-IP-Spoofing Proxy Validation**: Only connections originating from whitelisted `TRUSTED_PROXIES` can forward client IPs via `X-Forwarded-For`.
- **File Ingestion Firewall**: Limits uploads to 10 MB (`HTTP 413`), fast header rejection, enforces strict extension whitelisting (`.txt, .md, .pdf, .csv`), and strips directory traversal markers (`Path.name`).
- **Prompt Injection & Adversarial Guard**: Sanitizes adversarial jailbreak phrases and system prompt overrides (`### System:`, `[INST]`, `Ignore previous instructions`) before retrieval and synthesis.
- **Hardened CORS Policy**: Scopes cross-origin resource sharing to designated frontend origins with explicit credential checks.
- **Production Secret Gating**: Refuses to boot in staging/production if `JWT_SECRET_KEY` uses development defaults or is under 32 characters.

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

### `app/core/` (Security, Rate Limiting & Observability)

- **`core/security.py`**:
  - `hash_password(password)`: Generates salted bcrypt hashes with cost factor 12.
  - `verify_password(plain, hashed)`: Constant-time password hash verification against timing attacks.
  - `create_access_token(data, expires_delta)`: Encodes signed HMAC-SHA256 JWT tokens containing `sub` (user_id) and `exp` claims.
- **`core/rate_limit.py`**:
  - `RateLimitMiddleware`: Thread-safe sliding-window rate limiter per client IP. Enforces tiered thresholds (20 auth/min, 60 query/min, 300 global/min) and emits standard `HTTP 429` with `Retry-After`.
  - Anti-IP-spoofing: Resolves `X-Forwarded-For` only when direct peer connection matches `settings.trusted_proxies`.
- **`core/security_headers.py`**:
  - `SecurityHeadersMiddleware`: Emits OWASP defensive headers (`HSTS`, `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`) on every HTTP response.
- **`core/sanitizer.py`**:
  - `sanitize_filename(name)`: Strips directory traversal (`../`, `..\`) and null bytes (`\x00`).
  - `validate_file_extension(filename)`: Rejects executable and script extensions (`.exe`, `.sh`, `.py`, `.js`).
  - `validate_file_content_signature(file_bytes, ext)`: Inspects magic bytes (`%PDF-` for PDFs; rejects `MZ`, `ELF`, Mach-O).
  - `guard_prompt_query(query)`: Neutralizes prompt injection phrases (`ignore instructions`, `DAN mode`) and delimiter tags (`### System:`, `[INST]`).
- **`core/logging.py`**:
  - `RequestCorrelationMiddleware`: Attaches unique UUID `X-Request-ID` to request scope and response headers.
  - `JSONLogFormatter`: Formats logs into structured single-line JSON with timestamps, correlation IDs, latency in ms, and status codes.

### `app/services/` (Retrieval, Vector Embeddings & Synthesis)

- **`services/embedding.py`**:
  - `BaseEmbeddingProvider`: Abstract interface for vector generation (`embed_texts`, `embed_text`).
  - `LocalEmbeddingProvider`: Deterministic offline 256-dim unit-normalized signed hash projection over tokens and character 3-grams.
  - `OpenAIEmbeddingProvider`, `GeminiEmbeddingProvider`, `OllamaEmbeddingProvider`: Production integrations for OpenAI, Google Gemini, and local Ollama inference.
  - `cosine_similarity(vec_a, vec_b)`: Vector cosine similarity clamped strictly to `[-1.0, 1.0]`.
- **`services/retrieval.py`**:
  - `bm25_rank(query_tokens, corpus_tokens)`: Okapi BM25 lexical ranker with IDF and length normalization.
  - `dense_vector_rank(query_embedding, corpus_embeddings)`: Computes cosine similarity against stored chunk embeddings.
  - `reciprocal_rank_fusion(bm25_order, semantic_order, total_docs)`: Merges rank positions using non-parametric RRF ($k=60$).
  - `retrieve_chunks(db, project_id, query, top_k, mode)`: Executes hybrid/bm25/semantic retrieval and returns ranked `SourceCitation` schemas.
- **`services/llm.py`**:
  - `BaseLLMProvider`: Abstract interface for grounded answer generation.
  - `MockLLMProvider`: Deterministic local provider producing citation-referenced grounded answers.
  - `OpenAILLMProvider`, `GeminiLLMProvider`, `OllamaLLMProvider`: Vendor synthesis clients supporting both batch and streaming inference.
  - `stream_grounded_answer(question, sources)`: Generator yielding progressive token deltas for real-time SSE streaming.
- **`services/ingestion.py`**:
  - `extract_file_info(file_bytes, filename, file_type)`: Extracts text via `pypdf` for PDFs or UTF-8 decoding for text/markdown.
  - `chunk_text(content, chunk_size, overlap)`: Multi-paragraph sliding window with `_extract_overlap_seed()` sentence preservation.
  - `ingest_document(db, project_id, name, content, file_type, file_size)`: Coordinates text extraction, chunking, dense vector batch embedding, and relational persistence.

### `app/api/` (Routers & Endpoints)

- **`api/auth.py`**: User registration, login, and profile introspection (`/auth/register`, `/auth/login`, `/auth/me`).
- **`api/deps.py`**: Injects database session (`get_db`) and decodes authenticated user (`get_current_user`).
- **`api/projects.py`**: Workspace CRUD scoped strictly to `owner_id = current_user.id` (`GET`, `POST`, `PATCH`, `DELETE`).
- **`api/documents.py`**: Multi-format document upload with 64KB chunked streaming bounds (`/upload`), raw text indexing, chunk inspection (`/{document_id}`), and document deletion.
- **`api/retrieval.py`**:
  - `POST /projects/{id}/query`: Synchronous batch RAG query with citations and execution latency.
  - `POST /projects/{id}/query/stream`: Real-time Server-Sent Events (SSE) token streaming (`text/event-stream`, `X-Accel-Buffering: no`).
  - `POST /projects/{id}/search`: Top-K ranked source chunks without LLM synthesis.
- **`api/evaluations.py`**: Benchmark telemetry recording and historical pagination (`/evaluations`).

### `app/scripts/seed.py`

- `seed_database(db, reset, verbose)`: CLI tool populating enterprise users (`admin@vectorly.ai`, `engineer@vectorly.ai`), 3 workspaces, 5 documents, 9 dense-vectorized chunks, and 8 evaluation runs.

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

---

## 8. Backend Interview Scenarios & Systems Engineering Talking Points

### Scenario 1: Why did you decouple chunk retrieval from the SSE generator?
**Answer:**
> *"Holding a database connection open inside an asynchronous token-yielding generator keeps connection pool resources hostage while waiting on external model latency (e.g. 3-8 seconds). Under even moderate concurrency, the connection pool becomes exhausted, starving simple requests like health checks and user lookups.*
>
> *In `backend/app/api/retrieval.py`, we execute `retrieve_chunks()` synchronously within the normal dependency lifecycle, map citations into memory, and close the DB transaction. The generator only handles streaming LLM tokens, completely isolating database connections from network token latency."*

### Scenario 2: How does your local embedding provider work deterministically without external models?
**Answer:**
> *"In `backend/app/services/embedding.py`, `LocalEmbeddingProvider` projects tokens and character 3-grams into a fixed 256-dimensional space using MD5-based signed hashing. By incorporating character 3-grams alongside whole words, morphological variants (e.g. 'encrypt', 'encryption', 'encrypted') share active buckets.*
>
> *We then apply strict $L_2$ unit normalization: $\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2}$. This guarantees that all vectors reside on the unit hypersphere, making vector dot products identical to cosine similarities in the exact range $[-1.0, 1.0]$ without requiring PyTorch, native C libraries, or external API keys."*

### Scenario 3: How does the sliding-window rate limiter handle reverse proxies and IP spoofing?
**Answer:**
> *"If a rate limiter naively trusts `X-Forwarded-For` from any incoming request, an attacker can supply fake IPs (`X-Forwarded-For: 10.0.0.1`), rotate them on every hit, and bypass rate limits indefinitely.*
>
> *Our `RateLimitMiddleware` checks the direct peer socket (`request.client.host`). Only if the peer IP belongs to `TRUSTED_PROXIES` (e.g. `127.0.0.1` or the internal Docker gateway) will it trust the forwarded header. Direct untrusted connections have their forwarded headers discarded, binding rate limits strictly to the true client socket."*

### Scenario 4: How does Alembic support both SQLite and PostgreSQL without crashing on column modifications?
**Answer:**
> *"Standard SQLite does not support native `ALTER TABLE DROP COLUMN` or complex column alterations. In migration `d9a2b3c4d5e6`, we utilized Alembic's `op.batch_alter_table('document_chunks')`. Under SQLite, batch mode creates a shadow table with the new schema, copies existing records, drops the old table, and renames the shadow table. Under PostgreSQL, it automatically falls back to native `ALTER TABLE` DDL statements, giving us 100% test compatibility across both engines."*
