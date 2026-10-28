# Vectorly backend

The backend foundation for the Retrieval-Aware AI Infrastructure Platform.

## Run locally

From the `backend` directory:

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The health endpoint is available at `http://localhost:8000/health`.
Interactive OpenAPI docs are available at `http://localhost:8000/docs`.

## Authentication API

Authentication endpoints are available under `/api/v1/auth`:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

- `POST /api/v1/auth/register` requires `email` and `password` (minimum 8 characters), and accepts an optional `full_name`.
- `POST /api/v1/auth/login` returns a signed JWT access token (`access_token`, `token_type: "bearer"`).
- `GET /api/v1/auth/me` returns the authenticated user's profile and requires an `Authorization: Bearer <token>` header.

## Project API

Project CRUD endpoints are available under `/api/v1/projects` and require authentication (`Authorization: Bearer <token>`):

```text
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
```

- When creating a project, `owner_id` is automatically derived from the authenticated user.
- Listing projects automatically returns only projects belonging to the authenticated user.
- Retrieving, updating, or deleting a project by ID is strictly scoped to the project's owner (returning 404 if not found or unauthorized).
- The `description` field is optional and can be set to `null` when updating a project.

## Configuration

Settings are loaded from environment variables or a local `.env` file:

```text
APP_ENV=development
DATABASE_URL=postgresql+psycopg://localhost:5432/vectorly
REDIS_URL=redis://localhost:6379/0
LLM_PROVIDER=mock
LLM_MODEL=local-development
JWT_SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Blank values for configuration keys are rejected during application startup.

## Test

```bash
pytest
```
