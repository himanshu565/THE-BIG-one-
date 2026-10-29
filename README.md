# Vectorly — Retrieval-Aware AI Infrastructure Platform

Vectorly combines a high-performance FastAPI retrieval engine with a Next.js workspace for indexing documents, managing knowledge projects, and generating verified grounded answers.

## Architecture

```text
Frontend (Next.js 14 + Tailwind CSS)
    |  http://localhost:3000
    |  (Auth JWT, Project Selector, Live Document Upload, RAG Query Bar)
    v
FastAPI Backend (app.main:app)
    |  http://localhost:8000/api/v1 (CORS enabled)
    |  ├── /auth: Register, Login, Me (JWT Bearer tokens)
    |  ├── /projects: Authenticated workspace CRUD
    |  ├── /projects/{id}/documents: Upload, chunking, and indexing
    |  └── /projects/{id}/query: Hybrid retrieval (BM25 + Semantic RRF)
    v
PostgreSQL / SQLite Database
    └── Managed via Alembic migrations
```

## Running the Complete Platform Locally

### 1. Start the FastAPI Backend

From the repository root (or `backend/` directory):

```powershell
cd backend
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- API Base URL: `http://localhost:8000/api/v1`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Start the Next.js Frontend

In a separate terminal from the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.
- Use the **⚡ 1-Click Demo Login** button to automatically create and authenticate a demo session (`demo@vectorly.ai`) with a preloaded starter project and sample documentation.
- Or register your own account and create isolated project workspaces.

## Testing

Run the automated backend test suite (31 tests covering auth, migrations, ingestion, projects, and hybrid retrieval):

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```

Run the frontend production build:

```powershell
npm run build
```
