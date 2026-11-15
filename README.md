# Vectorly — Retrieval-Aware AI Infrastructure Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF.svg?style=flat&logo=github-actions&logoColor=white)](https://github.com/)
[![Tests](https://img.shields.io/badge/Tests-65_Passed-success.svg)](https://pytest.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Vectorly** is a production-grade, full-stack AI infrastructure platform designed for **reliable, citation-backed knowledge retrieval (RAG)**. It pairs a high-performance **FastAPI** backend with an intuitive, modular **Next.js 14** workspace.

> 📚 **Deep Dive Guide**: Want to understand every architectural decision, why we built it this way, and how features work in the background? Read our in-depth pedagogical guide: **[`TEACH_ME.md`](./TEACH_ME.md)**.

---

## Key Features

- 🔐 **Multi-Tenant JWT Authentication**: Secure bcrypt password hashing and token-scoped project authorization preventing cross-tenant data leakage.
- 📁 **Isolated Project Workspaces**: Organize documentation into distinct workspaces with independent document indices and query pagination (`limit` & `offset`).
- 🌱 **Production Database Seeder CLI**: Automated CLI seeder (`python -m app.scripts.seed`) providing instant idempotent population of enterprise demo users, technical workspaces, documents, chunks, and benchmark runs.
- ⚡ **Hybrid RAG Retrieval Engine**: Combines **Okapi BM25 lexical search** and **Semantic Vector similarity** fused via **Reciprocal Rank Fusion (RRF)** ($k=60$) to eliminate keyword blindness and capture conceptual context.
- 🧠 **Pluggable LLM Synthesis Layer**: Provider interface supporting **Mock**, **OpenAI**, **Google Gemini**, and **Ollama** local models producing grounded answers with verifiable source document citations and chunk indices.
- 📊 **Persistent Evaluations Domain**: Automated benchmarking telemetry recording query latency, chunk coverage, and retrieval modes persisted directly in the relational schema.
- 📄 **Hardened Multi-Format Ingestion**: Sliding-window chunker supporting `.md`, `.txt`, `.csv`, and `.pdf` (via `pypdf`) with sentence-boundary overlap preservation, magic byte inspection (`validate_file_content_signature`), encrypted PDF detection, and chunked streaming memory bounds (anti-DoS).
- 🚀 **Zero-Config Local Development**: Pre-configured file-based SQLite database with automatic table initialization on launch—zero database servers required to get started. Seamlessly toggle to PostgreSQL in `.env`.
- 🛡️ **Enterprise Anti-Hack Security Shield**: OWASP security headers (HSTS, strict CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff), tiered sliding-window rate limiting per IP (20/min Auth, 60/min Queries, 300/min Global), reverse proxy IP spoofing defense (`TRUSTED_PROXIES`), path-traversal sanitization, 10MB upload cap, strict extension whitelisting, and adversarial prompt injection filtering.
- 🩺 **Active Database Readiness Probing**: `GET /health` executes a `SELECT 1` query against the connection pool, returning `HTTP 503 Service Unavailable` if the database is disconnected.
- 📊 **Structured JSON Logging & Observability**: Correlation middleware injecting and propagating `X-Request-ID` with structured single-line JSON log events.
- 🐳 **Production Containerization & CI/CD**: Hardened multi-stage Dockerfiles (`backend/Dockerfile`, `Dockerfile`), `docker-compose.yml` (Postgres 16, Redis 7, Backend, Frontend), and automated GitHub Actions CI pipeline.
- 📱 **Fully Modular Minimalist UI**: High-contrast monochrome interface with global Command Palette (`⌘ K` / `Ctrl+K`), desktop sidebar, mobile navigation, live latency benchmarks, real-time audit activity feed, and modal chunk inspectors.
- 🧪 **Comprehensive Automated Verification**: 65 backend pytest tests (including dedicated security and database seed tests), a 37-button / 34-interaction automated frontend test suite, and 0 ESLint warnings/errors.

---

## Architecture Overview

```text
[ Browser / Client ]
        │
        │ HTTP REST (Authorization: Bearer <jwt>)
        ▼
Next.js 14 Frontend (http://localhost:3000)
  ├─ AuthScreen: Sign in, Register, and 1-Click Instant Demo Login
  ├─ Overview: Live workspace KPIs, Quick Ask, and Project Context
  ├─ Ask your data: Interactive RAG with Hybrid / BM25 / Semantic modes
  ├─ Documents: File upload, chunk inspection modal, and live text indexing
  ├─ Projects: Workspace management, edit modal, and activation
  ├─ Evaluations: Live latency & chunk coverage benchmark runner
  ├─ Activity: Filterable audit log of retrieval & security events
  └─ Settings: Real-time API health probe with latency counter
        │
        │ CORS-enabled API + X-Request-ID
        ▼
FastAPI Backend (http://localhost:8000/api/v1)
  ├─ Middleware: RequestCorrelation (X-Request-ID), SecurityHeaders, RateLimit, CORS
  ├─ /auth: Register, login, and profile verification (JWT + bcrypt)
  ├─ /projects: Authenticated workspace CRUD scoped to current_user.id
  ├─ /documents: Multi-format text & PDF ingestion, magic byte checks, chunking
  ├─ /query: Hybrid retrieval (BM25 + Semantic Cosine + RRF) + Grounded LLM synthesis
  └─ /health: Live database readiness probe (SELECT 1)
        │
        ▼
Database (SQLite vectorly.db OR PostgreSQL 16)
  └── Managed via SQLAlchemy 2.0 ORM & Alembic migrations
```

---

## Quick Start (Run Locally in 2 Minutes)

### Prerequisites
- **Node.js**: v18.0 or newer (v20+ recommended)
- **Python**: v3.11 or v3.12

---

### Option A: Standard Local Development

#### Step 1: Start the FastAPI Backend

Open a terminal in the project directory:

```powershell
# Navigate to backend directory
cd backend

# Create & activate a virtual environment (if not already done)
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # On Linux/macOS: source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run the backend server (starts on SQLite vectorly.db out of the box)
uvicorn app.main:app --reload --port 8000
```

- **API Base URL**: `http://localhost:8000/api/v1`
- **Interactive OpenAPI Docs**: `http://localhost:8000/docs`
- **Health & Readiness Check**: `http://localhost:8000/health`

#### Step 2: Start the Next.js Frontend

Open a second terminal in the project root:

```powershell
# Install Node dependencies
npm install

# Start development server
npm run dev
```

Open **`http://localhost:3000`** in your browser.

> ⚡ **Tip**: Click the **"⚡ 1-Click Instant Demo Login"** button on the sign-in screen to instantly authenticate as `demo@vectorly.ai` with a pre-seeded project workspace and sample documents.

---

### Option B: Full Docker Stack (One Command)

To run the complete stack (PostgreSQL 16, Redis 7, FastAPI Backend, Next.js Frontend) in production containers:

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

---

## Database Configuration

Vectorly supports both **zero-config local SQLite** and **production PostgreSQL**:

| Environment Variable | SQLite (Default) | PostgreSQL (Production) |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./backend/vectorly.db` | `postgresql+psycopg://user:password@localhost:5432/vectorly` |

To switch to PostgreSQL:
1. Open `.env` (or `backend/.env`).
2. Uncomment the PostgreSQL line and supply your credentials:
   ```env
   DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/vectorly
   ```
3. Run Alembic migrations:
   ```bash
   alembic upgrade head
   ```

---

## REST API Reference

All protected endpoints require `Authorization: Bearer <token>`.

### Platform Health & Readiness
- `GET /health` — Active liveness & database readiness check (`SELECT 1`). Returns HTTP 200 when healthy, HTTP 503 when the database is unreachable.

### Authentication
- `POST /api/v1/auth/register` — Create a new user account.
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token.
- `GET /api/v1/auth/me` — Return currently authenticated user profile.

### Workspaces & Projects
- `GET /api/v1/projects?limit=100&offset=0` — List projects owned by the authenticated user with limit/offset pagination.
- `POST /api/v1/projects` — Create a new project workspace.
- `GET /api/v1/projects/{project_id}` — Get project details by ID.
- `PATCH /api/v1/projects/{project_id}` — Update project name or description.
- `DELETE /api/v1/projects/{project_id}` — Delete project and its documents.

### Documents & Ingestion
- `GET /api/v1/projects/{project_id}/documents?limit=100&offset=0` — List documents in a project with pagination.
- `POST /api/v1/projects/{project_id}/documents` — Index a text or markdown document directly.
- `POST /api/v1/projects/{project_id}/documents/upload` — Upload and chunk a file (`.txt`, `.md`, `.csv`, `.pdf`) with chunked stream bounds.
- `GET /api/v1/projects/{project_id}/documents/{document_id}` — Inspect document metadata and all indexed chunks.
- `DELETE /api/v1/projects/{project_id}/documents/{document_id}` — Delete a document and its indexed chunks.

### Retrieval & RAG
- `POST /api/v1/projects/{project_id}/query` — Execute hybrid search and generate grounded answer with citations.
- `POST /api/v1/projects/{project_id}/search` — Return ranked source chunks without LLM synthesis.

### Evaluations & Telemetry
- `POST /api/v1/projects/{project_id}/evaluations` — Persist an automated benchmark run (latency, mode, chunks found).
- `GET /api/v1/projects/{project_id}/evaluations?limit=50&offset=0` — Retrieve historical evaluation telemetry with pagination.

---

## Database Seeder CLI

Vectorly includes an automated database seeder for instant production demo setup:

```bash
# Run seeder with sample projects, documents, chunks, and evaluations
python -m app.scripts.seed

# Or wipe and re-seed from scratch
python -m app.scripts.seed --reset
```

Default credentials provisioned:
- **Admin**: `admin@vectorly.ai` / `AdminPass123!`
- **Staff Engineer**: `engineer@vectorly.ai` / `EngineerPass123!`

---

## Automated Testing

### 1. Frontend UI Verification Suite
Verifies all 37 UI buttons, click bindings, and 34 simulated user interaction flows:

```bash
npm test
```

### 2. Frontend Linting
Runs strict ESLint analysis ensuring clean code formatting:

```bash
npm run lint
```

### 3. Backend Pytest Suite
Runs 65 automated tests covering auth, security, repositories, chunking, migrations, LLM providers, evaluations, database seeder, and the hybrid retrieval engine:

```bash
cd backend
pytest -v
```

### 4. Production Build Validation
Compiles Next.js static pages and verifies TypeScript types:

```bash
npm run build
```

---

## Troubleshooting

- **Error: `fe_sendauth: no password supplied`**:
  You are connecting to PostgreSQL without credentials. Ensure `.env` is set to `DATABASE_URL=sqlite:///./backend/vectorly.db` for zero-config mode, or configure PostgreSQL username and password.
- **Error: `Cannot find module './819.js'`**:
  Occurs when `npm run build` runs while `next dev` is running. Delete the stale cache folder:
  ```powershell
  Remove-Item -Recurse -Force .next
  npm run dev
  ```

---

## Documentation Links

- **[`TEACH_ME.md`](./TEACH_ME.md)** — Comprehensive architecture, design choices, algorithmic formulations, background flow execution, anti-hack security layers, and DevOps pipelines.
- **[`backend/LEARNER_GUIDE.md`](./backend/LEARNER_GUIDE.md)** — Backend-specific learner guide, database schema, and roadmap.
