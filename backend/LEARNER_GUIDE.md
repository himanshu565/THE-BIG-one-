# Vectorly Backend Learner Guide

This guide explains the current backend implementation as if you are learning the
project from the beginning. It describes not only what the code does, but also why
each design decision was made, what trade-offs it creates, and how the system should
evolve.

## 1. What we are building

Vectorly is a retrieval-aware AI infrastructure platform. Its future responsibilities
include:

- organizing users' work into projects;
- storing and processing documents;
- answering questions using retrieved document context;
- evaluating retrieval quality;
- tracking activity and workspace settings.

The current backend milestone implements the first real domain: **projects**. A
project is a user-owned workspace that will eventually contain documents, retrieval
settings, evaluations, and activity.

The backend currently exposes:

```text
GET    /health

POST   /api/v1/projects
GET    /api/v1/projects?owner_id=7
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
```

## 2. System design approach

The backend follows a small layered architecture:

```text
HTTP request
    |
    v
FastAPI router
    |  validates input and selects HTTP response
    v
Pydantic schemas
    |  defines the API contract
    v
Repository functions
    |  contains database operations
    v
SQLAlchemy model
    |  maps Python objects to database rows
    v
PostgreSQL database
```

The database session is supplied through FastAPI dependency injection:

```text
request -> get_db() -> repository -> commit/rollback responsibility -> close session
```

This separation is intentional:

- **Routers** should understand HTTP concepts such as status codes and query
  parameters.
- **Schemas** should describe what clients may send and what they receive.
- **Repositories** should understand persistence, but not HTTP.
- **Models** should describe database structure, not request validation.
- **Configuration** should be loaded in one predictable place.

This prevents the route handler from becoming a large function that mixes parsing,
business rules, SQL, and response formatting.

## 3. Why this technology stack was chosen

### FastAPI

FastAPI was chosen because it provides:

- typed route parameters and return values;
- automatic request validation;
- generated OpenAPI documentation;
- straightforward dependency injection;
- good async support for later AI and document-processing workloads.

For this project, the important benefit is that the API contract can be expressed in
normal Python type annotations and Pydantic models instead of being duplicated in
manual validation code.

### Pydantic and pydantic-settings

Pydantic validates external data at the application boundary. HTTP payloads are
untrusted input, so validation belongs before repository code runs.

`pydantic-settings` applies the same typed approach to configuration. Environment
variables and `.env` values are converted into a `Settings` object, and invalid blank
values are rejected early.

### SQLAlchemy

SQLAlchemy was chosen as the persistence layer because it:

- maps database tables to typed Python models;
- supports PostgreSQL in production and SQLite in focused tests;
- keeps SQL access explicit and testable;
- supports transactions, relationships, indexes, and migrations as the system grows.

The project uses SQLAlchemy's modern typed declarative style with `Mapped` and
`mapped_column`, which makes model fields easier to understand and type-check.

### PostgreSQL

PostgreSQL is the intended application database because Vectorly will need reliable
transactions, indexes, relational ownership, and likely metadata associated with
documents and evaluations. It is a stronger production choice than keeping the
application on an embedded database.

SQLite is used only in tests because it is fast and does not require a running
database service.

### pytest and FastAPI TestClient

`pytest` provides small, readable tests. `TestClient` exercises the API through the
same route and validation layers that a real HTTP client uses. This is more valuable
than testing only repository functions because it verifies the complete request path.

## 4. Project structure

```text
backend/
├── app/
│   ├── api/
│   │   └── projects.py       # HTTP routes for projects
│   ├── config/
│   │   └── settings.py       # Environment-backed application settings
│   ├── db/
│   │   └── database.py       # SQLAlchemy engine, Base, and session dependency
│   ├── models/
│   │   └── project.py        # Database table mapping
│   ├── repositories/
│   │   └── projects.py       # Project persistence operations
│   ├── schemas/
│   │   └── project.py        # Request and response API contracts
│   └── main.py               # FastAPI application composition
├── tests/
│   ├── test_health.py
│   ├── test_projects_api.py
│   ├── test_projects_repository.py
│   └── test_settings.py
└── requirements.txt
```

## 5. File-by-file explanation

### `app/main.py`

This is the application composition root. It creates the `FastAPI` instance and
registers routers.

```python
app.include_router(projects_router, prefix="/api/v1")
```

The `/api/v1` prefix is a versioning boundary. If a future breaking API change is
needed, `/api/v2` can be introduced without immediately breaking existing clients.
The route module only describes `/projects`, so versioning stays centralized.

The `/health` endpoint is deliberately lightweight. It answers whether the process
is alive; it does not yet prove that PostgreSQL, Redis, or an LLM provider is
available. Readiness checks should be added separately when deployment needs them.

### `app/config/settings.py`

`Settings` is the typed configuration object. The fields use aliases such as
`DATABASE_URL` so environment variables follow conventional uppercase naming while
Python code uses readable snake_case names.

`get_settings()` uses `@lru_cache` so the process creates one settings object instead
of repeatedly reading and parsing environment configuration.

The blank-value validator protects required operational choices such as the LLM
provider. A blank provider is not a useful default and should fail during startup or
configuration construction rather than fail later inside an AI request.

### `app/db/database.py`

`Base` is the parent class for SQLAlchemy models. SQLAlchemy uses its metadata to
know which mapped tables exist.

`engine` owns the database connection configuration. `pool_pre_ping=True` checks
stale pooled connections before use, which is useful for long-running web services.

`SessionLocal` is a factory. It creates independent sessions so concurrent requests
do not share one mutable transaction.

`get_db()` is a FastAPI dependency. It yields a session to a route and always closes
it in `finally`. Closing in one place prevents connection leaks.

At this stage, repository functions commit their own successful writes. As workflows
become multi-step, transaction ownership may move upward so one use case can commit
or roll back several repository operations atomically.

### `app/models/project.py`

`Project` maps to the `projects` table.

- `id` is the primary key.
- `name` is required and capped at 200 characters.
- `description` is optional long-form text.
- `owner_id` identifies the owning user and is indexed for filtering.
- `created_at` is generated by the database and is required.

The database model describes storage constraints. It is not used as the direct HTTP
request model because storage concerns and public API concerns are different. For
example, clients should not be allowed to choose `id` or `created_at`.

### `app/schemas/project.py`

There are three schemas because the operations have different contracts.

#### `ProjectCreate`

Used for `POST`. It requires:

- a non-empty `name`;
- an optional `description`;
- a positive `owner_id`.

`Field(min_length=1, max_length=200)` prevents invalid names before they reach the
database.

#### `ProjectUpdate`

Used for `PATCH`. Every field is optional because PATCH means partial update. The
distinction between “field omitted” and “field explicitly set to null” matters:

- omitted `description` means keep the existing description;
- `"description": null` means clear it.

The route preserves that distinction using `model_dump(exclude_unset=True)`.

#### `ProjectResponse`

Used for output. `ConfigDict(from_attributes=True)` allows Pydantic to serialize a
SQLAlchemy model instance without manually constructing a dictionary.

Keeping response fields explicit prevents accidental leakage of future internal
database fields.

### `app/repositories/projects.py`

This module owns project persistence operations and keeps SQLAlchemy details out of
the HTTP layer.

#### `create_project`

It constructs a `Project`, adds it to the session, commits the transaction, refreshes
the object, and returns it.

`refresh()` is important because database-generated values such as `id` and
`created_at` may not be fully available on the Python object until after the insert.

#### `list_projects`

It optionally filters by `owner_id` and orders newest projects first. The secondary
`id` ordering makes rows with the same timestamp deterministic.

The owner filter is currently explicit because the authentication system does not
exist yet. Once authentication is added, the owner should come from the authenticated
identity rather than being trusted from arbitrary client input.

#### `get_project`

It uses `db.get(Project, project_id)` for a primary-key lookup. Returning `None`
instead of raising an HTTP exception keeps this function independent of FastAPI.

#### `update_project`

It loads the entity, returns `None` if it does not exist, applies only supplied
fields, commits, refreshes, and returns the updated entity.

The `_UNSET` sentinel is used for `description` because `None` is a meaningful value.
Without a sentinel, the function could not distinguish “do not change description”
from “set description to null.”

#### `delete_project`

It returns a boolean to tell the route whether a row existed. The repository does not
know that a missing row should become HTTP 404; the route makes that HTTP decision.

### `app/api/projects.py`

This module translates HTTP requests into repository calls.

`APIRouter` groups project routes and applies the `projects` tag used in generated
API documentation.

The route handlers are intentionally thin:

1. FastAPI parses and validates the request.
2. Dependency injection provides a database session.
3. The handler calls a repository function.
4. The handler converts missing entities into `404`.
5. FastAPI serializes the response using the declared schema.

The create route returns `201 Created` because a new resource was created. The delete
route returns `204 No Content` because it succeeds without returning a body.

### `tests/test_projects_api.py`

The API tests use an in-memory SQLite database. `StaticPool` and
`check_same_thread=False` are required because FastAPI's test client can execute
requests in another thread, while a normal `sqlite:///:memory:` connection would
create isolated databases per connection.

The dependency override replaces the production database session only during tests.
The override is removed in `finally`, so one test cannot leak its database into
another test or into another use of the application object.

The tests cover:

- create;
- list with owner filtering;
- partial update;
- clearing a nullable description;
- delete;
- validation failure;
- missing-resource `404`.

## 6. Request lifecycle example

For `POST /api/v1/projects`:

```text
Client sends JSON
    |
    v
FastAPI matches POST /api/v1/projects
    |
    v
Pydantic builds ProjectCreate or returns 422
    |
    v
FastAPI calls get_db()
    |
    v
projects.create_project(...)
    |
    v
SQLAlchemy INSERT + COMMIT
    |
    v
SQLAlchemy refreshes generated id/created_at
    |
    v
ProjectResponse serializes the result
    |
    v
HTTP 201 response
```

## 7. Important current limitations

These are deliberate boundaries of the first API slice, not hidden guarantees:

1. **Authentication is not implemented.** `owner_id` is currently supplied by the
   client for development. This must be replaced with the authenticated user before
   production use.
2. **Authorization is not implemented.** Any caller that knows an ID could currently
   request, update, or delete it.
3. **Migrations are not implemented.** The tests create tables from metadata, but a
   production deployment needs Alembic migrations and a migration step in deployment.
4. **No pagination exists yet.** The list endpoint returns all matching projects.
   Pagination should be added before the dataset becomes large.
5. **No service/use-case layer exists yet.** Repository calls are sufficient for this
   simple CRUD slice. Cross-domain workflows should move business orchestration into
   a service layer rather than making routers complicated.
6. **Health is liveness only.** A separate readiness endpoint should check required
   dependencies when the deployment model needs that distinction.

## 8. Why not put everything in one file?

A single file would be faster for the first endpoint, but it would combine:

- HTTP routing;
- validation;
- database access;
- serialization;
- configuration.

That structure becomes difficult to test and change when documents, retrieval jobs,
evaluation runs, and authentication are added. The current boundaries are small
enough for a learner to follow while establishing patterns that can scale.

## 9. Recommended next design steps

The next phases should be implemented in this order:

1. Add authentication and derive the owner from the authenticated principal.
2. Add Alembic migrations and a safe database startup/deployment process.
3. Add pagination and consistent filtering to project listing.
4. Add documents with a project foreign key.
5. Add document upload and ingestion job boundaries.
6. Add retrieval/query APIs behind an LLM-provider abstraction.
7. Add evaluation APIs and persisted benchmark results.
8. Add readiness checks, structured logging, and request correlation IDs.
9. Add integration tests against PostgreSQL or a containerized database.

Each new domain should follow the same basic pattern:

```text
model -> schema -> repository -> service/use case when needed -> router -> tests
```

## 10. How to study and run the backend

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

From the `backend` directory, start the development server:

```powershell
python -m uvicorn app.main:app --reload
```

Then open the generated API documentation at:

```text
http://localhost:8000/docs
```

When learning, read the code in this order:

1. `app/models/project.py`
2. `app/schemas/project.py`
3. `app/repositories/projects.py`
4. `app/api/projects.py`
5. `app/main.py`
6. `tests/test_projects_api.py`

That order follows the data from storage representation to public HTTP behavior.
