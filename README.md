# Vectorly — Retrieval-Aware AI Infrastructure Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Vectorly** is a production-grade, full-stack AI infrastructure platform designed for **reliable, citation-backed knowledge retrieval (RAG)**. It pairs a high-performance **FastAPI** backend with an intuitive, responsive **Next.js 14** workspace.

> 📚 **Deep Dive Guide**: Want to understand every architectural decision, why we built it this way, and how features work in the background? Read our in-depth pedagogical guide: **[`TEACH_ME.md`](./TEACH_ME.md)**.

---

## Key Features

- 🔐 **Multi-Tenant JWT Authentication**: Secure bcrypt password hashing and token-scoped project authorization preventing cross-tenant data leakage.
- 📁 **Isolated Project Workspaces**: Organize documentation into distinct workspaces with independent document indices.
- ⚡ **Hybrid RAG Retrieval Engine**: Combines **Okapi BM25 lexical search** and **Semantic Vector similarity** fused via **Reciprocal Rank Fusion (RRF)** ($k=60$) to eliminate keyword blindness and capture conceptual context.
- 🧠 **Grounded Answer Synthesis**: Pluggable LLM interface producing grounded answers with verifiable source document citations and chunk indices.
- 📄 **Multi-Format Ingestion**: Sliding-window chunker supporting `.md`, `.txt`, `.csv`, and file uploads with sentence-boundary preservation.
- 🚀 **Zero-Config Local Development**: Pre-configured file-based SQLite database with automatic table initialization on launch—zero database servers required to get started. Seamlessly toggle to PostgreSQL in `.env`.
- 🛡️ **Enterprise Anti-Hack Security Shield**: OWASP security headers (HSTS, strict CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff), tiered sliding-window rate limiting per IP (20/min Auth, 60/min Queries, 300/min Global), path-traversal sanitization, 10MB upload cap, strict extension whitelisting, and adversarial prompt injection filtering.
- 📱 **Fully Responsive Minimalist UI**: High-contrast monochrome interface with global Command Palette (`⌘ K` / `Ctrl+K`), desktop sidebar, mobile navigation strip, and interactive modal chunk inspectors.
- 🧪 **Comprehensive Automated Verification**: 42 backend pytest tests (including 11 dedicated security tests) and a 37-button / 34-interaction automated frontend test suite.

---

## Architecture Overview

```text
[ Browser / Client ]
        │
        │ HTTP REST (Authorization: Bearer <jwt>)
        ▼
Next.js 14 Frontend (http://localhost:3000)
  ├─ AuthScreen: Sign in, Register, and 1-Click Instant Demo Login
  ├─ Overview: Workspace KPIs, Quick Ask, and Project Context
  ├─ Ask your data: Interactive RAG with Hybrid / BM25 / Semantic modes
  ├─ Documents: File upload, chunk inspection, and live text indexing
  └─ Projects: Workspace management and activation
        │
        │ CORS-enabled API
        ▼
FastAPI Backend (http://localhost:8000/api/v1)
  ├─ /auth: Register, login, and profile verification (JWT + bcrypt)
  ├─ /projects: Authenticated workspace CRUD scoped to current_user.id
  ├─ /documents: Multi-format text ingestion & sliding-window chunking
  └─ /query: Hybrid retrieval (BM25 + Semantic Cosine + RRF) + Grounded LLM synthesis
        │
        ▼
Database (SQLite vectorly.db OR PostgreSQL 5432)
  └── Managed via SQLAlchemy 2.0 ORM & Alembic migrations
```

---

## Quick Start (Run Locally in 2 Minutes)

### Prerequisites
- **Node.js**: v18.0 or newer (v20+ recommended)
- **Python**: v3.11 or v3.12

---

### Step 1: Start the FastAPI Backend

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
- **Health Check**: `http://localhost:8000/health`

---

### Step 2: Start the Next.js Frontend

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

### Authentication
- `POST /api/v1/auth/register` — Create a new user account.
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token.
- `GET /api/v1/auth/me` — Return currently authenticated user profile.

### Workspaces & Projects
- `GET /api/v1/projects` — List all projects owned by the authenticated user.
- `POST /api/v1/projects` — Create a new project workspace.
- `GET /api/v1/projects/{project_id}` — Get project details by ID.
- `PATCH /api/v1/projects/{project_id}` — Update project name or description.
- `DELETE /api/v1/projects/{project_id}` — Delete project and its documents.

### Documents & Ingestion
- `GET /api/v1/projects/{project_id}/documents` — List all documents in a project.
- `POST /api/v1/projects/{project_id}/documents` — Index a text or markdown document directly.
- `POST /api/v1/projects/{project_id}/documents/upload` — Upload and chunk a file (`.txt`, `.md`, `.csv`, `.pdf`).
- `DELETE /api/v1/projects/{project_id}/documents/{document_id}` — Delete a document and its indexed chunks.

### Retrieval & RAG
- `POST /api/v1/projects/{project_id}/query` — Execute hybrid search and generate grounded answer with citations.
- `POST /api/v1/projects/{project_id}/search` — Return ranked source chunks without LLM synthesis.

---

## Automated Testing

### 1. Frontend UI Verification Suite
Verifies all 29 UI buttons, their bindings, click handlers, and 27 end-to-end user state interactions:

```bash
npm test
```

### 2. Backend Pytest Suite
Runs 31 automated tests covering auth, security, repositories, chunking, migrations, and the hybrid retrieval engine:

```bash
cd backend
pytest -v
```

### 3. Production Build Validation
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

- **[`TEACH_ME.md`](./TEACH_ME.md)** — Comprehensive architecture, design choices, algorithmic formulations, and background flow execution.
- **[`backend/LEARNER_GUIDE.md`](./backend/LEARNER_GUIDE.md)** — Backend-specific learner guide and roadmap.
