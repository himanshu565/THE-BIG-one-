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
POST   /api/v1/projects/{project_id}/search
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
- `MockLLMProvider` synthesizes grounded answers with citations during development and automated tests.

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
│   │   ├── projects.py       # Authenticated project CRUD endpoints
│   │   └── retrieval.py      # Hybrid RAG query and search endpoints
│   ├── config/
│   │   └── settings.py       # Environment-backed application settings
│   ├── core/
│   │   └── security.py       # Password hashing & JWT generation/decoding
│   ├── db/
│   │   └── database.py       # SQLAlchemy engine, Base, and session dependency
│   ├── models/
│   │   ├── document.py       # Document and DocumentChunk table mappings
│   │   ├── project.py        # Project table mapping
│   │   └── user.py           # User table mapping
│   ├── repositories/
│   │   ├── documents.py      # Document persistence operations
│   │   ├── projects.py       # Project persistence operations (owner scoped)
│   │   └── users.py          # User persistence operations
│   ├── schemas/
│   │   ├── document.py       # Document request and response contracts
│   │   ├── project.py        # Project request and response contracts
│   │   ├── query.py          # Query request, response, and citation schemas
│   │   └── user.py           # Auth request and response contracts
│   ├── services/
│   │   ├── ingestion.py      # Text extraction and chunking pipeline
│   │   ├── llm.py            # LLM provider interface and mock implementation
│   │   └── retrieval.py      # BM25, semantic similarity, and RRF ranker
│   └── main.py               # FastAPI application composition
├── tests/
│   ├── test_auth_api.py
│   ├── test_documents_api.py
│   ├── test_health.py
│   ├── test_ingestion.py
│   ├── test_migrations.py
│   ├── test_projects_api.py
│   ├── test_projects_repository.py
│   ├── test_retrieval.py
│   ├── test_settings.py
│   └── test_users_repository.py
└── requirements.txt
```

## 5. File-by-file explanation

### `app/services/retrieval.py`

- `bm25_rank(query_tokens, corpus_tokens)`: calculates Okapi BM25 scores with document length normalization.
- `semantic_vector_rank(query_tokens, corpus_tokens)`: calculates cosine similarity between term vectors.
- `reciprocal_rank_fusion(bm25_order, semantic_order, total_docs)`: combines both rankings using standard RRF ($k=60$).
- `retrieve_chunks(db, project_id, query, top_k, mode)`: executes ranking and returns structured `SourceCitation` models.

### `app/services/llm.py`

- `generate_grounded_answer(question, sources)`: produces an answer synthesizing context from the top retrieved chunks with explicit citation references.

### `app/api/retrieval.py`

- `POST /api/v1/projects/{project_id}/query`: verifies project ownership, retrieves source chunks, generates grounded answer, and measures execution latency.
- `POST /api/v1/projects/{project_id}/search`: retrieves ranked source chunks without LLM synthesis.

## 6. Recommended next design steps

The next phases should be implemented in this order:

1. [COMPLETED] Add authentication and derive the owner from the authenticated principal.
2. [COMPLETED] Add Alembic migrations and a safe database startup/deployment process.
3. [COMPLETED] Add documents domain with project foreign key, upload endpoint, and chunking pipeline.
4. [COMPLETED] Add retrieval/query APIs behind an LLM-provider abstraction (hybrid BM25 + vector search preview).
5. Add frontend integration connecting `app/page.tsx` views to the backend API.
6. Add evaluation APIs and persisted benchmark results.
7. Add readiness checks, structured logging, and request correlation IDs.

## 7. How to run tests

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```
