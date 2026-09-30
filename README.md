# Vectorly frontend

The frontend prototype for the Retrieval-Aware AI Infrastructure Platform.

## Included screens

- Overview dashboard with retrieval health and workspace metrics
- Ask your data with a local grounded-answer preview
- Documents library with search, status filtering, and upload simulation
- Projects workspace
- Retrieval evaluations and benchmark history
- Activity timeline
- Workspace settings and notification preferences

The UI is intentionally frontend-only for now. All content is local mock data and all
actions are designed to be replaced by FastAPI calls in later milestones.

## Backend foundation

The first FastAPI backend milestone is available in [`backend/`](./backend/).
It currently exposes a liveness endpoint:

```text
GET http://localhost:8000/health
```

Run it from the `backend` directory:

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Run the backend test with:

```bash
pytest
```

Backend configuration is loaded from environment variables or a local `.env` file:

```text
APP_ENV=development
DATABASE_URL=postgresql://localhost:5432/vectorly
REDIS_URL=redis://localhost:6379/0
LLM_PROVIDER=mock
LLM_MODEL=local-development
```

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production build:

```bash
npm run build
npm run start
```
