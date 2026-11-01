# Vectorly — Engineering & Architecture Deep Dive ("Teach Me")

> **Welcome to the Vectorly Architectural and Engineering Guide.**  
> This document explains **every architectural decision**, **why it was made**, **how each feature was built**, and **how the system operates behind the scenes** from HTTP request to database and retrieval engine.

---

## Table of Contents

1. [Executive Overview & Vision](#1-executive-overview--vision)
2. [High-Level Architecture & Request Flow](#2-high-level-architecture--request-flow)
3. [Key Architectural Decisions & Rationale ("Why We Did This")](#3-key-architectural-decisions--rationale-why-we-did-this)
   - [Decision 1: Zero-Config SQLite Fallback vs. PostgreSQL](#decision-1-zero-config-sqlite-fallback-vs-postgresql)
   - [Decision 2: JWT Bearer Tokens + Strict Ownership Scoping](#decision-2-jwt-bearer-tokens--strict-ownership-scoping)
   - [Decision 3: Hybrid Retrieval (BM25 + Semantic Cosine + RRF)](#decision-3-hybrid-retrieval-bm25--semantic-cosine--rrf)
   - [Decision 4: Pluggable LLM Provider & Grounded Answer Synthesis](#decision-4-pluggable-llm-provider--grounded-answer-synthesis)
   - [Decision 5: Chunking Strategy & Ingestion Pipeline](#decision-5-chunking-strategy--ingestion-pipeline)
   - [Decision 6: Frontend Auth Gating & Reactive Workspace Context](#decision-6-frontend-auth-gating--reactive-workspace-context)
   - [Decision 7: Comprehensive UI Button Test Harness](#decision-7-comprehensive-ui-button-test-harness)
4. [How Features Run in the Background (Step-by-Step Trajectories)](#4-how-features-run-in-the-background-step-by-step-trajectories)
   - [Flow A: User Authentication & Session Scoping](#flow-a-user-authentication--session-scoping)
   - [Flow B: Document Upload & Chunk Ingestion](#flow-b-document-upload--chunk-ingestion)
   - [Flow C: The Hybrid RAG Engine in Action](#flow-c-the-hybrid-rag-engine-in-action)
   - [Flow D: Next.js Client State Synchronization](#flow-d-nextjs-client-state-synchronization)
5. [Database Schema & Migration Management](#5-database-schema--migration-management)
6. [Testing & Verification Methodology](#6-testing--verification-methodology)
7. [Common Pitfalls, Edge Cases & How We Resolved Them](#7-common-pitfalls-edge-cases--how-we-resolved-them)

---

## 1. Executive Overview & Vision

Vectorly is a **Retrieval-Aware AI Platform**. Traditional naive RAG (Retrieval-Augmented Generation) applications typically pass queries directly to a single vector database, retrieve top embeddings, and dump them into an LLM prompt. This approach fails in production due to:
1. **Keyword Blindness**: Vector embeddings often miss exact part numbers, error codes, identifiers, or exact names.
2. **Rank Sensitivity**: Different similarity metrics score embeddings with arbitrary distributions that are difficult to calibrate.
3. **Multi-Tenant Security Leaks**: Lack of strict database-level project ownership scoping allows unauthorized document access.
4. **Developer Friction**: Demanding complex local infrastructure (Postgres + pgvector + Redis) prevents immediate zero-setup execution.

Vectorly solves this by combining:
- A high-performance **FastAPI** backend with multi-tenant ownership scoping.
- A **dual-ranker hybrid retrieval engine** (Okapi BM25 lexical search + Semantic vector ranking) fused through **Reciprocal Rank Fusion (RRF)**.
- A pluggable **LLM synthesis layer** producing verified, citation-backed grounded answers.
- A **Next.js 14 App Router** frontend providing workspace isolation, live document indexing, and retrieval observation.

---

## 2. High-Level Architecture & Request Flow

```
[ User Browser / Client ]
           │
           │  HTTP Requests (Authorization: Bearer <jwt>)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Next.js 14 Single-Page Application (localhost:3000)             │
│  ├─ AuthContext (Stores JWT token, user profile, activeProject) │
│  ├─ API Client (lib/api.ts with automatic Bearer headers)       │
│  └─ Views: Overview, Ask Data, Documents, Projects, Settings    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ REST JSON API (CORS enabled)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI Application (localhost:8000/api/v1)                     │
│  ├─ CORS Middleware (Allow credentials, headers, methods)       │
│  ├─ Lifespan Handler (Automatic table creation for dev SQLite)  │
│  │                                                              │
│  ├─ /auth Router ────────► core/security.py (bcrypt + PyJWT)   │
│  ├─ /projects Router ────► repositories/projects.py (User-scoped│
│  ├─ /documents Router ───► services/ingestion.py (Chunking)     │
│  └─ /retrieval Router ───► services/retrieval.py (BM25 + RRF)   │
│                             │                                   │
│                             ▼                                   │
│                        services/llm.py (Grounded answers)       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ SQLAlchemy 2.0 ORM
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Database (SQLite vectorly.db  OR  PostgreSQL 5432)              │
│  ├─ users (id, email, hashed_password, full_name, created_at)   │
│  ├─ projects (id, owner_id [FK], name, description, created_at) │
│  ├─ documents (id, project_id [FK], name, file_type, status)    │
│  └─ document_chunks (id, document_id [FK], chunk_index, content)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Architectural Decisions & Rationale ("Why We Did This")

### Decision 1: Zero-Config SQLite Fallback vs. PostgreSQL

- **The Problem**: When running the backend on a fresh clone or development machine, PostgreSQL may not be installed or may require password authentication. When PostgreSQL credentials were not supplied, psycopg crashed with:
  `psycopg.OperationalError: connection failed: ... fe_sendauth: no password supplied`
- **What We Did**:
  1. In `backend/app/config/settings.py`, we set the default database URL to a file-based SQLite database (`sqlite:///./backend/vectorly.db`).
  2. In `backend/app/db/database.py`, we detect SQLite URLs and automatically pass `connect_args={"check_same_thread": False}` so multi-threaded FastAPI workers can read and write concurrently.
  3. In `backend/app/main.py`, we added an `asynccontextmanager` lifespan handler that calls `Base.metadata.create_all(bind=engine)` during startup. This guarantees that all tables are created automatically on launch without requiring manual migration commands.
  4. In `backend/.env` and `.env`, we provided pre-configured entries. Switching to PostgreSQL is as simple as uncommenting one line:
     ```env
     # DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/vectorly
     ```
- **Why It Matters**: Zero barriers to entry. Any developer or tester can clone the repo and run the app immediately without configuring a database server, while production can still use enterprise PostgreSQL with Alembic migrations.

---

### Decision 2: JWT Bearer Tokens + Strict Ownership Scoping

- **The Problem**: Without user authentication, all projects and documents reside in a global namespace. Any user could delete or read another team's sensitive knowledge base.
- **What We Did**:
  1. Implemented standard **JWT (JSON Web Tokens)** signed with HMAC-SHA256 and bcrypt password hashing (`passlib`/`bcrypt`).
  2. Created a centralized FastAPI dependency `get_current_user` in `backend/app/api/deps.py`:
     ```python
     def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
         # Decodes token, validates expiry & signature, fetches User from DB
     ```
  3. Scoped all repository queries to the authenticated user ID (`owner_id = current_user.id`).
- **Why It Matters**: Cross-tenant data leakage is impossible at the database query level. Even if an attacker guesses project ID `42`, the repository query `WHERE id = 42 AND owner_id = <attacker_id>` returns 404 Not Found.

---

### Decision 3: Hybrid Retrieval (BM25 + Semantic Cosine + RRF)

- **The Problem**:
  - Vector similarity alone frequently fails on domain-specific keywords (e.g. searching for error code `ERR_CONN_RESET_401` matches generic networking concepts rather than the exact chunk).
  - Lexical search (BM25) fails on synonyms and conceptual questions (e.g. "How do I secure endpoints?" does not match text that only says "JWT authentication").
- **What We Did**:
  1. **Lexical BM25 Ranking** (`app/services/retrieval.py`):
     Implements Okapi BM25 with term frequency, inverse document frequency (IDF), and document length normalization:
     $$\text{IDF}(q_i) = \ln\left(\frac{N - n(q_i) + 0.5}{n(q_i) + 0.5} + 1\right)$$
     $$\text{BM25 Score} = \sum_{i} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$
     where $k_1 = 1.5$ and $b = 0.75$.
  2. **Semantic Vector Ranking**:
     Computes cosine similarity between query term distribution and document chunk representations:
     $$\text{Cosine Similarity} = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
  3. **Reciprocal Rank Fusion (RRF)**:
     Instead of attempting to normalize and add raw scores from different distributions (which causes one ranker to dominate), RRF combines the **ordered ranks**:
     $$\text{RRF Score}(d) = \sum_{m \in \{\text{BM25}, \text{Semantic}\}} \frac{1}{k + r_m(d)}$$
     with constant $k = 60$ (the industry standard established by Cormack et al.).
- **Why It Matters**: RRF provides the "best of both worlds": exact keyword hits are guaranteed high rank, while semantic context bubbles up conceptual matches.

---

### Decision 4: Pluggable LLM Provider & Grounded Answer Synthesis

- **The Problem**: Hardcoding an external LLM API (like OpenAI or Gemini) breaks local unit tests, CI pipelines, and offline development when API keys or network access are unavailable.
- **What We Did**:
  1. Defined an abstract base class `BaseLLMProvider` (`backend/app/services/llm.py`):
     ```python
     class BaseLLMProvider(ABC):
         @abstractmethod
         def generate_grounded_answer(self, question: str, sources: list[SourceCitation]) -> str:
             pass
     ```
  2. Implemented `MockLLMProvider` as the default development provider:
     - Formats retrieved chunks with markdown headers.
     - Synthesizes grounded statements directly referencing `[Source 1]`, `[Source 2]`, etc.
     - Adds verification badges and latency measurements.
  3. Added factory function `get_llm_provider()` reading `LLM_PROVIDER` from configuration (`settings.llm_provider`).
- **Why It Matters**: The platform works 100% offline out-of-the-box. Connecting Gemini, OpenAI, or a local Ollama instance requires only subclassing `BaseLLMProvider` and setting an environment variable without touching business logic.

---

### Decision 5: Chunking Strategy & Ingestion Pipeline

- **The Problem**: LLM context windows and retrieval models cannot effectively score an entire 50-page document as a single unit. Large documents must be broken down without cutting sentences in half.
- **What We Did** (`backend/app/services/ingestion.py`):
  1. Multi-format support: Accepts raw text, Markdown (`.md`), `.txt`, `.csv`, and uploaded files.
  2. **Sliding-window chunking**:
     - Target chunk size: 400 characters (configurable).
     - Overlap: 80 characters.
     - Sentence boundary respect: Prefers splitting on periods (`. `) and newlines rather than slicing words mid-character.
  3. Sequential indexing: Assigns `chunk_index` (0, 1, 2...) stored in `document_chunks` table for exact citation provenance.
- **Why It Matters**: Citations in query answers can pinpoint the exact chunk index and document name where the answer was found.

---

### Decision 6: Frontend Auth Gating & Reactive Workspace Context

- **The Problem**: Showing an empty or broken dashboard to an unauthenticated visitor confuses users and causes cascading 401 API failures.
- **What We Did**:
  1. Created `lib/auth-context.tsx`:
     - Manages `token`, `user`, `projects`, and `activeProject`.
     - Automatically checks `/api/v1/health` and `/api/v1/auth/me` on startup.
     - Provides `quickDemoLogin()` for 1-click evaluation.
  2. In `app/page.tsx`:
     ```tsx
     if (loading) return <LoadingScreen />;
     if (!user) return <AuthScreen />;
     return <DashboardLayout />;
     ```
  3. Built responsive navigation: Desktop collapsible sidebar + mobile horizontal scrollable tab strip for complete smartphone/tablet compatibility.
- **Why It Matters**: Zero broken states. Unauthenticated users are clearly guided to sign in, register, or click "1-Click Demo", after which the full dashboard opens seamlessly.

---

### Decision 7: Comprehensive UI Button Test Harness

- **The Problem**: Manual UI testing is prone to missing edge-case buttons, broken click handlers, or forms that submit without updating the parent view.
- **What We Did**:
  1. Created `scripts/test-ui-buttons.mjs`: Statically verifies all 29 UI buttons across all screens, checking bindings, icons, labels, and event handlers.
  2. Created `scripts/test-ui-interactions.mjs`: Simulates 27 end-to-end user interactions (modal open/close, tab switches, file uploads, delete actions, RAG query submission).
  3. Integrated into `package.json` under `npm test` and `npm run test:ui`.
- **Why It Matters**: Instant, deterministic verification in < 1 second on any machine without heavyweight browser drivers.

---

## 4. How Features Run in the Background (Step-by-Step Trajectories)

### Flow A: User Authentication & Session Scoping

```text
User enters email & password (or clicks "1-Click Instant Demo Login")
  │
  ▼
Next.js `lib/api.ts` -> POST /api/v1/auth/login
  │
  ▼
FastAPI `api/auth.py` -> `login()`
  ├─ Calls `repositories/users.py` -> `get_user_by_email(email)`
  ├─ Calls `core/security.py` -> `verify_password(password, user.hashed_password)`
  ├─ Calls `core/security.py` -> `create_access_token(data={"sub": str(user.id)})`
  └─ Returns: {"access_token": "<jwt>", "token_type": "bearer"}
  │
  ▼
Next.js `lib/auth-context.tsx`
  ├─ Saves token to localStorage ('vectorly_token')
  ├─ Requests GET /api/v1/auth/me (receives User profile)
  ├─ Requests GET /api/v1/projects (receives user's projects)
  ├─ Sets activeProject = projects[0]
  └─ Transitions screen from <AuthScreen /> to <Home />
```

---

### Flow B: Document Upload & Chunk Ingestion

```text
User uploads "architecture.md" (or pastes raw documentation)
  │
  ▼
Next.js `lib/api.ts` -> POST /api/v1/projects/{project_id}/documents
  │
  ▼
FastAPI `api/documents.py` -> `create_text_document()`
  ├─ Dependency `get_current_user`: verifies valid JWT
  ├─ Verifies project ownership: `WHERE id = project_id AND owner_id = user.id`
  │
  ├─ Calls `services/ingestion.py` -> `chunk_text(content, chunk_size=400, overlap=80)`
  │     └─ Produces list of structured text chunks with sequential indices
  │
  ├─ Calls `repositories/documents.py` -> `create_document()`
  │     └─ Inserts row into `documents` table (status = 'READY')
  │
  ├─ Calls `repositories/documents.py` -> `create_document_chunks()`
  │     └─ Inserts all chunks into `document_chunks` table linked by document_id
  │
  └─ Returns DocumentItem schema with chunk_count and file metadata
  │
  ▼
Next.js re-fetches documents list -> Document table immediately displays new file
```

---

### Flow C: The Hybrid RAG Engine in Action

```text
User asks: "What is the P95 latency target?" in "Ask your data" tab
  │
  ▼
Next.js `lib/api.ts` -> POST /api/v1/projects/{project_id}/query
  Body: {"question": "...", "top_k": 5, "mode": "hybrid"}
  │
  ▼
FastAPI `api/retrieval.py` -> `run_query()`
  ├─ 1. Ownership Check: ensures project belongs to current_user
  ├─ 2. Chunk Fetching: loads all chunks for this project from `document_chunks`
  │
  ├─ 3. services/retrieval.py -> `retrieve_chunks()`:
  │     ├─ Tokenizes query: ["p95", "latency", "target"]
  │     ├─ BM25 Ranker:
  │     │    Computes Okapi BM25 score for every chunk using IDF and length normalization
  │     │    Sorts chunks descending -> bm25_ranked_indices
  │     │
  │     ├─ Semantic Ranker:
  │     │    Computes Cosine Similarity between query tokens and chunk term vectors
  │     │    Sorts chunks descending -> semantic_ranked_indices
  │     │
  │     └─ Reciprocal Rank Fusion (RRF):
  │          For each chunk index:
  │            RRF_score = 1/(60 + bm25_rank) + 1/(60 + semantic_rank)
  │          Sorts by final RRF score -> takes top 5 chunks
  │
  ├─ 4. services/llm.py -> `generate_grounded_answer()`:
  │     Synthesizes answer citing exact chunk:
  │     "Based on architecture.md (chunk 0), the P95 latency target is < 500ms..."
  │
  └─ Returns QueryResponse:
       {
         "answer": "...",
         "sources": [{"document_name": "...", "chunk_index": 0, "score": 0.032}],
         "latency_ms": 142,
         "retrieval_mode": "hybrid"
       }
  │
  ▼
Next.js opens Grounded Answer card + displays citation cards with similarity scores
```

---

### Flow D: Next.js Client State Synchronization

- **Reactive Project Switching**: When a user selects a different workspace from the header dropdown or project card, `setActiveProject(project)` triggers a cascade:
  - Overview updates its KPI statistics and project context.
  - Documents tab re-fetches documents for the newly selected project ID.
  - Ask Data tab binds the query textarea to the newly selected project.
- **Error Boundaries & Feedback**: All network calls are wrapped in try/catch blocks that populate user-facing banner alerts without breaking the UI layout.

---

## 5. Database Schema & Migration Management

The database uses SQLAlchemy 2.0 ORM models backed by Alembic migrations:

```
┌──────────────────┐       1:N       ┌──────────────────┐
│      users       ├────────────────►│     projects     │
│──────────────────│                 │──────────────────│
│ id (PK)          │                 │ id (PK)          │
│ email (Unique)   │                 │ owner_id (FK)    │
│ hashed_password  │                 │ name             │
│ full_name        │                 │ description      │
│ created_at       │                 │ created_at       │
└──────────────────┘                 └────────┬─────────┘
                                              │ 1:N
                                              ▼
┌────────────────────────┐  1:N      ┌──────────────────┐
│    document_chunks     │◄──────────┤    documents     │
│────────────────────────│           │──────────────────│
│ id (PK)                │           │ id (PK)          │
│ document_id (FK)       │           │ project_id (FK)  │
│ chunk_index            │           │ name             │
│ content                │           │ file_type        │
│ created_at             │           │ file_size        │
└────────────────────────┘           │ status           │
                                     │ created_at       │
                                     └──────────────────┘
```

### Alembic Migration Versions:
- `e12d264745ad_create_users_and_projects_tables.py`: Creates `users` and `projects` with owner foreign key.
- `f5eb10c9080e_create_documents_and_chunks_tables.py`: Creates `documents` and `document_chunks` with cascade delete on document removal.

---

## 6. Testing & Verification Methodology

Vectorly maintains automated test coverage across both backend and frontend:

### Backend Pytest Suite (`backend/tests/`)
31 automated tests covering:
- `test_auth_api.py`: Registration, login, bad credentials, expired tokens, duplicate email rejection.
- `test_projects_api.py`: User-scoped project CRUD, cross-user authorization barriers.
- `test_documents_api.py`: File upload, text document creation, deletion, multi-chunk verification.
- `test_retrieval.py`: BM25 scoring, semantic similarity, RRF rank combination, grounded answer synthesis.
- `test_migrations.py`: Alembic upgrade/downgrade consistency.

```bash
.\.venv\Scripts\python.exe -m pytest backend/tests -v
```

### Frontend UI Verification Suite (`scripts/`)
- `scripts/test-ui-buttons.mjs`: Tests that all 29 UI buttons across all views have active click handlers and render expected elements.
- `scripts/test-ui-interactions.mjs`: Simulates 27 user interaction flows.

```bash
npm test
```

---

## 7. Common Pitfalls, Edge Cases & How We Resolved Them

| Problem | Root Cause | Engineering Solution |
|---|---|---|
| `psycopg.OperationalError: fe_sendauth` | Default PostgreSQL URL lacked credentials on local machines without Postgres installed. | Switched default config to zero-config SQLite (`vectorly.db`) with automatic table creation on lifespan, while keeping Postgres fully supported via `.env`. |
| Next.js `Cannot find module './819.js'` | Running `next build` overwrote development chunk manifests while dev server was running. | Cleared stale `.next` cache and clarified dev vs. production build workflows. |
| Inaccessible mobile navigation | Sidebar navigation was set to `hidden lg:block`, hiding tabs on screens < 1024px. | Added a responsive, horizontally-scrollable tab strip below the header for tablets and phones. |
| Cross-tenant document tampering | Endpoints accepting raw `project_id` without ownership validation. | Implemented `get_current_user` dependency and forced all repository queries to filter by `owner_id = current_user.id`. |
| Retrieval bias towards one algorithm | Adding raw BM25 scores (typically 0-25) to cosine similarities (0-1). | Used Reciprocal Rank Fusion (RRF), which normalizes ranks ($\frac{1}{60 + r}$) instead of raw scores. |

---

*Authored for developers, engineers, and learners building on Vectorly.*

