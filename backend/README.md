# Vectorly backend

The backend foundation for the Retrieval-Aware AI Infrastructure Platform.

## Run locally

From the `backend` directory:

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The health endpoint is available at `http://localhost:8000/health`.

## Project API

Project CRUD endpoints are available under `/api/v1/projects`:

```text
POST   /api/v1/projects
GET    /api/v1/projects?owner_id=7
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
```

Create requests require `name` and a positive `owner_id`. The `description` field
is optional and can be set to `null` when updating a project.

## Configuration

Settings are loaded from environment variables or a local `.env` file:

```text
APP_ENV=development
DATABASE_URL=postgresql+psycopg://localhost:5432/vectorly
REDIS_URL=redis://localhost:6379/0
LLM_PROVIDER=mock
LLM_MODEL=local-development
```

Blank values for the environment, LLM provider, or LLM model are rejected during
application startup.

## Test

```bash
pytest
```
