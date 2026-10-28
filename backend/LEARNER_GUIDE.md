# Vectorly Backend Learner Guide

This guide explains the current backend implementation as if you are learning the
project from the beginning. It describes not only what the code does, but also why
each design decision was made, what trade-offs it creates, and how the system should
evolve.

## 1. What we are building

Vectorly is a retrieval-aware AI infrastructure platform. Its future responsibilities
include:

- authenticating users and managing workspaces;
- organizing users' work into user-owned projects;
- storing and processing documents;
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
```

## 2. System design approach

The backend follows a small layered architecture:

```text
HTTP request (with Bearer token)
    |
    v
FastAPI router & dependencies (get_db, get_current_user)
    |  validates token, parses inputs, enforces authentication & ownership
    v
Pydantic schemas
    |  defines the API contract
    v
Repository functions
    |  contains database operations scoped to owner
    v
SQLAlchemy models (User, Project)
    |  maps Python objects to database rows
    v
PostgreSQL / SQLite database (managed via Alembic migrations)
```

The database session and authenticated user are supplied through FastAPI dependency injection:

```text
request -> get_current_user() -> get_db() -> repository (scoped to user.id) -> response
```

This separation is intentional:

- **Routers** should understand HTTP concepts such as status codes, tokens, and headers.
- **Schemas** should describe what clients may send and what they receive.
- **Repositories** should understand persistence and queries, but not HTTP.
- **Models** should describe database structure, not request validation.
- **Security utilities** isolate cryptographic hashing and token signing.
- **Alembic migrations** manage versioned schema evolution across environments.
- **Configuration** should be loaded in one predictable place.

## 3. Why this technology stack was chosen

### FastAPI

FastAPI was chosen because it provides:

- typed route parameters and return values;
- automatic request validation;
- generated OpenAPI documentation;
- straightforward dependency injection (`Depends(get_current_user)`);
- good async support for later AI and document-processing workloads.

### Passwords & Tokens (bcrypt & PyJWT)

- **bcrypt** provides salted, slow key derivation resistant to brute-force attacks.
- **PyJWT** generates cryptographically signed Bearer tokens with expiration timestamps, enabling stateless authentication.

### SQLAlchemy & Alembic

- **SQLAlchemy** maps database tables to typed Python models.
- **Alembic** manages reproducible schema migrations so production databases transition safely without data loss or manual SQL scripts. `alembic/env.py` connects dynamically using the application's runtime `DATABASE_URL`.

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
│   │   └── projects.py       # HTTP routes for authenticated project CRUD
│   ├── config/
│   │   └── settings.py       # Environment-backed application settings
│   ├── core/
│   │   └── security.py       # Password hashing & JWT generation/decoding
│   ├── db/
│   │   └── database.py       # SQLAlchemy engine, Base, and session dependency
│   ├── models/
│   │   ├── project.py        # Project table mapping (with owner_id foreign key)
│   │   └── user.py           # User table mapping
│   ├── repositories/
│   │   ├── projects.py       # Project persistence operations (owner scoped)
│   │   └── users.py          # User persistence operations
│   ├── schemas/
│   │   ├── project.py        # Project request and response contracts
│   │   └── user.py           # Auth request and response contracts
│   └── main.py               # FastAPI application composition
├── tests/
│   ├── test_auth_api.py
│   ├── test_health.py
│   ├── test_migrations.py
│   ├── test_projects_api.py
│   ├── test_projects_repository.py
│   ├── test_settings.py
│   └── test_users_repository.py
└── requirements.txt
```

## 5. File-by-file explanation

### `alembic/env.py`

Loads the application's `Settings` and configures Alembic against `settings.database_url`. Links `target_metadata = Base.metadata` so that schema migrations can be automatically generated via `alembic revision --autogenerate`.

### `app/core/security.py`

Contains the security primitives:
- `hash_password(plain)` creates a bcrypt salt and hash.
- `verify_password(plain, hashed)` validates incoming credentials.
- `create_access_token(subject)` signs a JWT with user identifier and expiration.
- `decode_access_token(token)` validates cryptographic signature and expiration.

### `app/api/deps.py`

Defines `get_current_user`:
1. Extracts Bearer token from the `Authorization` header.
2. Decodes token payload; raises `401 Unauthorized` if invalid or expired.
3. Fetches user from the database; raises `401` if not found or `400` if inactive.
4. Yields the verified `User` instance to route handlers.

### `app/api/projects.py`

Every project endpoint is protected with `current_user: User = Depends(get_current_user)`.
- `create_project`: automatically sets `owner_id = current_user.id`. The caller cannot choose or spoof project ownership.
- `list_projects`: scopes results to `owner_id = current_user.id`.
- `get_project`, `update_project`, `delete_project`: enforces that the project belongs to `current_user.id`, returning `404` for unauthorized or nonexistent projects.

### `app/repositories/projects.py`

Persistence functions accept `owner_id` to enforce database query scoping.

## 6. Request lifecycle example

For authenticated `POST /api/v1/projects`:

```text
Client sends JSON + Authorization: Bearer <token>
    |
    v
FastAPI checks Bearer token via get_current_user()
    |
    v
Decodes JWT, fetches User(id=42)
    |
    v
Pydantic builds ProjectCreate
    |
    v
FastAPI calls get_db()
    |
    v
projects.create_project(owner_id=42, ...)
    |
    v
SQLAlchemy INSERT + COMMIT
    |
    v
ProjectResponse serializes the result
    |
    v
HTTP 201 response
```

## 7. Important current limitations

These are deliberate boundaries of the current backend slice:

1. **No pagination exists yet.** The list endpoint returns all matching projects. Pagination should be added before the dataset grows.
2. **No service/use-case layer exists yet.** Repository calls are sufficient for simple CRUD, but multi-domain workflows will benefit from service-level orchestration.
3. **Health is liveness only.** A readiness check should verify database connectivity.

## 8. Recommended next design steps

The next phases should be implemented in this order:

1. [COMPLETED] Add authentication and derive the owner from the authenticated principal.
2. [COMPLETED] Add Alembic migrations and a safe database startup/deployment process.
3. Add pagination and consistent filtering to project listing.
4. Add documents with a project foreign key.
5. Add document upload and ingestion job boundaries.
6. Add retrieval/query APIs behind an LLM-provider abstraction.
7. Add evaluation APIs and persisted benchmark results.
8. Add readiness checks, structured logging, and request correlation IDs.
9. Add integration tests against PostgreSQL or a containerized database.

## 9. How to run tests

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -v
```
