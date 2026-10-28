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
- answering questions using retrieved document context;
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
Services (Ingestion & Chunking)
    |  extracts text, generates semantic chunks, computes token estimates
    v
Pydantic schemas
    |  defines the API contract
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

### FastAPI

FastAPI was chosen because it provides:

- typed route parameters and return values;
- automatic request validation and multipart file uploads (`UploadFile`);
- generated OpenAPI documentation;
- straightforward dependency injection (`Depends(get_current_user)`);
- good async support for later AI and document-processing workloads.

### Passwords & Tokens (bcrypt & PyJWT)

- **bcrypt** provides salted, slow key derivation resistant to brute-force attacks.
- **PyJWT** generates cryptographically signed Bearer tokens with expiration timestamps, enabling stateless authentication.

### SQLAlchemy & Alembic

- **SQLAlchemy** maps database tables to typed Python models with cascading relationships.
- **Alembic** manages reproducible schema migrations so production databases transition safely without data loss. `alembic/env.py` connects dynamically using the application's runtime `DATABASE_URL`.

## 4. Project structure

```text
backend/
├── alembic/
│   ├── versions/             # Migration scripts
│   └── env.py                # Alembic environment runner
├── alembic.ini               # Migration configuration
├── app/
│   ├── api/
│   │   ├── auth.py           # HTTP routes for registration and login
│   │   ├── deps.py           # Dependency injection (get_current_user)
│   │   ├── documents.py      # HTTP routes for document upload and retrieval
│   │   └── projects.py       # HTTP routes for authenticated project CRUD
│   ├── config/
│   │   └── settings.py       # Environment-backed application settings
│   ├── core/
│   │   └── security.py       # Password hashing & JWT generation/decoding
│   ├── db/
│   │   └── database.py       # SQLAlchemy engine, Base, and session dependency
│   ├── models/
│   │   ├── document.py       # Document and DocumentChunk table mappings
│   │   ├── project.py        # Project table mapping (with owner_id foreign key)
│   │   └── user.py           # User table mapping
│   ├── repositories/
│   │   ├── documents.py      # Document persistence operations
│   │   ├── projects.py       # Project persistence operations (owner scoped)
│   │   └── users.py          # User persistence operations
│   ├── schemas/
│   │   ├── document.py       # Document request and response contracts
│   │   ├── project.py        # Project request and response contracts
│   │   └── user.py           # Auth request and response contracts
│   ├── services/
│   │   └── ingestion.py      # Text extraction and chunking pipeline
│   └── main.py               # FastAPI application composition
├── tests/
│   ├── test_auth_api.py
│   ├── test_documents_api.py
│   ├── test_health.py
│   ├── test_ingestion.py
│   ├── test_migrations.py
│   ├── test_projects_api.py
│   ├── test_projects_repository.py
│   ├── test_settings.py
│   └── test_users_repository.py
└── requirements.txt
```

## 5. File-by-file explanation

### `app/services/ingestion.py`

Controls document ingestion and text segmentation:
- `chunk_text(text, chunk_size, chunk_overlap)` segments text into coherent windows respecting paragraph and sentence boundaries.
- `estimate_tokens(text)` estimates token size for downstream LLM context windows.
- `extract_file_info(filename, bytes)` detects file extension and decodes text content.
- `ingest_document(db, document, text)` commits chunk segments and updates document status to `ready`.

### `app/api/documents.py`

Handles document management:
- Uploads multipart files or creates direct text documents.
- Verifies that the caller owns the target project before processing.
- Supports listing with status filtering and retrieving documents with their chunk breakdown.
- Cascades deletion of document chunks on document removal.

## 6. Recommended next design steps

The next phases should be implemented in this order:

1. [COMPLETED] Add authentication and derive the owner from the authenticated principal.
2. [COMPLETED] Add Alembic migrations and a safe database startup/deployment process.
3. [COMPLETED] Add documents domain with project foreign key, upload endpoint, and chunking pipeline.
4. Add retrieval/query APIs behind an LLM-provider abstraction (hybrid BM25 + vector search preview).
5. Add frontend integration connecting `app/page.tsx` views to the backend API.
6. Add evaluation APIs and persisted benchmark results.
7. Add readiness checks, structured logging, and request correlation IDs.

## 7. How to run tests

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```
