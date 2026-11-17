"""Production database seeder for the Vectorly platform.

Idempotently pre-populates enterprise users, production workspaces, technical
documentation, chunks, and historical evaluation benchmark runs.

Usage:
    python -m app.scripts.seed
    python -m app.scripts.seed --reset
    python -m app.scripts.seed --quiet
"""

import argparse
import sys
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path so 'app' imports work when executed directly
_backend_root = Path(__file__).resolve().parent.parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.database import Base, SessionLocal, engine
from app.models.document import Document, DocumentChunk
from app.models.evaluation import EvaluationRun
from app.models.project import Project
from app.models.user import User
from app.services.ingestion import ingest_document


SEED_PROJECTS_DATA = [
    {
        "name": "Vectorly Architecture & Production SLOs",
        "description": "Core platform retrieval architecture, latency budget SLOs, and reciprocal rank fusion parameters.",
        "documents": [
            {
                "name": "architecture_overview.md",
                "content": (
                    "# Vectorly Platform Architecture Overview\n\n"
                    "## High-Performance Hybrid Retrieval Engine\n"
                    "Vectorly employs a dual-path hybrid retrieval pipeline combining lexical token matching "
                    "via Okapi BM25 and dense semantic cosine scoring across token vectors.\n\n"
                    "### Reciprocal Rank Fusion (RRF)\n"
                    "Search results are fused using the Reciprocal Rank Fusion algorithm:\n"
                    "RRF_score(d) = sum(1 / (k + rank(d)))\n"
                    "where k is the smoothing constant set to 60. This balances keyword exact matches "
                    "against semantic approximations.\n\n"
                    "### Strict Grounding & Anti-Hallucination\n"
                    "All generated responses cite the exact document name and chunk index. When retrieved "
                    "context is insufficient, the system rejects speculation and reports insufficient data.\n\n"
                    "### Latency Budget\n"
                    "Our RAG latency budget is strictly 200 milliseconds end-to-end for p95 retrieval queries."
                ),
            },
            {
                "name": "production_slos.md",
                "content": (
                    "# Production Service Level Objectives (SLOs)\n\n"
                    "## Reliability & Availability Targets\n"
                    "- Uptime Target: 99.9% monthly availability across all public endpoints.\n"
                    "- Query Retrieval Latency: p50 < 80ms, p95 < 150ms, p99 < 200ms.\n"
                    "- Ingestion Throughput: >= 50 pages per second with paragraph chunking and boundary snapping.\n\n"
                    "## Multi-Tenant Isolation\n"
                    "Every project workspace and document chunk is scoped strictly to owner ID.\n"
                    "Cross-tenant access attempts return HTTP 404 Not Found to prevent workspace enumeration."
                ),
            },
        ],
        "evaluations": [
            {
                "query": "What is the RAG latency budget for Vectorly?",
                "latency_ms": 45,
                "chunks_found": 4,
                "mode": "hybrid",
                "status": "Passed",
            },
            {
                "query": "How does Reciprocal Rank Fusion combine BM25 and semantic rankings?",
                "latency_ms": 38,
                "chunks_found": 5,
                "mode": "hybrid",
                "status": "Passed",
            },
            {
                "query": "What are the availability SLOs for Vectorly production?",
                "latency_ms": 29,
                "chunks_found": 3,
                "mode": "bm25",
                "status": "Passed",
            },
        ],
    },
    {
        "name": "Enterprise Security & Threat Modeling",
        "description": "Defense-in-depth security model, OWASP Top 10 defenses, rate limits, and injection sanitization.",
        "documents": [
            {
                "name": "anti_hack_playbook.md",
                "content": (
                    "# Enterprise Anti-Hack & Defensive Playbook\n\n"
                    "## OWASP Top 10 Defense Architecture\n"
                    "1. HTTP Security Headers:\n"
                    "   - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n"
                    "   - Content-Security-Policy: default-src 'self'\n"
                    "   - X-Frame-Options: DENY (prevents clickjacking)\n"
                    "   - X-Content-Type-Options: nosniff (prevents MIME confusion attacks)\n\n"
                    "2. Rate Limiting:\n"
                    "   - Sliding-window in-memory or Redis rate limiting.\n"
                    "   - 20 requests/min for Auth endpoints.\n"
                    "   - 60 requests/min for Query endpoints.\n"
                    "   - 300 requests/min Global limit per client IP.\n\n"
                    "3. Prompt Injection Shield:\n"
                    "   - Adversarial delimiter filtering strips attempts to override system prompts.\n"
                    "   - Magic byte validation and chunked streaming limits prevent upload memory exhaustion."
                ),
            },
            {
                "name": "api_key_security.md",
                "content": (
                    "# Enterprise API Key Architecture\n\n"
                    "## Cryptographic Key Generation & Validation\n"
                    "API keys follow the standard format: vec_live_<32_random_bytes_hex>.\n"
                    "Keys are hashed using SHA-256 before storage in the database.\n"
                    "Plaintext keys are displayed once upon creation and never stored.\n\n"
                    "## Dual-Auth Architecture\n"
                    "Endpoints accept either User JWT Bearer tokens or SHA-256 hashed API keys seamlessly."
                ),
            },
        ],
        "evaluations": [
            {
                "query": "How does Vectorly thwart prompt injection attacks?",
                "latency_ms": 62,
                "chunks_found": 5,
                "mode": "hybrid",
                "status": "Passed",
            },
            {
                "query": "What rate limits are enforced on authentication endpoints?",
                "latency_ms": 31,
                "chunks_found": 3,
                "mode": "semantic",
                "status": "Passed",
            },
            {
                "query": "Explain client IP resolution behind reverse proxies",
                "latency_ms": 44,
                "chunks_found": 4,
                "mode": "hybrid",
                "status": "Passed",
            },
        ],
    },
    {
        "name": "Cloud Infrastructure & Containerization",
        "description": "Docker multi-stage builds, non-root execution, Docker Compose stack, and Kubernetes deployment guides.",
        "documents": [
            {
                "name": "docker_kubernetes_guide.md",
                "content": (
                    "# Cloud Infrastructure & Orchestration Guide\n\n"
                    "## Multi-Stage Containerization\n"
                    "The backend Dockerfile uses a multi-stage Python 3.12-slim build to minimize image size.\n"
                    "A non-root user (appuser, UID 10001) executes the FastAPI ASGI server.\n\n"
                    "## Docker Compose Stack\n"
                    "- Postgres: PostgreSQL 16 Alpine with persistent volume and healthcheck.\n"
                    "- Redis: Redis 7 Alpine with persistent cache volume.\n"
                    "- Backend: FastAPI service with health probe /health.\n"
                    "- Frontend: Next.js standalone container.\n\n"
                    "## Kubernetes Readiness Probes\n"
                    "Liveness and readiness probes point to GET /health with a 15-second interval."
                ),
            },
        ],
        "evaluations": [
            {
                "query": "How are non-root users configured in the backend Dockerfile?",
                "latency_ms": 54,
                "chunks_found": 4,
                "mode": "hybrid",
                "status": "Passed",
            },
            {
                "query": "What are the healthcheck endpoints for container orchestration?",
                "latency_ms": 26,
                "chunks_found": 2,
                "mode": "bm25",
                "status": "Passed",
            },
        ],
    },
]


def seed_database(db: Session, reset: bool = False, verbose: bool = True) -> dict[str, int]:
    """Seed the database with users, projects, documents, chunks, and evaluations."""
    if reset:
        if verbose:
            print("  [RESET] Cleaning existing database records...")
        db.query(EvaluationRun).delete()
        db.query(DocumentChunk).delete()
        db.query(Document).delete()
        db.query(Project).delete()
        db.query(User).delete()
        db.commit()

    created_counts = {
        "users": 0,
        "projects": 0,
        "documents": 0,
        "chunks": 0,
        "evaluations": 0,
    }

    # 1. Ensure Admin User exists
    admin = db.query(User).filter(User.email == "admin@vectorly.ai").first()
    if not admin:
        admin = User(
            email="admin@vectorly.ai",
            hashed_password=hash_password("AdminPass123!"),
            full_name="Vectorly Administrator",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        created_counts["users"] += 1
        if verbose:
            print(f"  [+] Created User: {admin.email} (ID: {admin.id})")

    # 2. Ensure Staff Engineer User exists
    engineer = db.query(User).filter(User.email == "engineer@vectorly.ai").first()
    if not engineer:
        engineer = User(
            email="engineer@vectorly.ai",
            hashed_password=hash_password("EngineerPass123!"),
            full_name="Staff AI Engineer",
            is_active=True,
        )
        db.add(engineer)
        db.commit()
        db.refresh(engineer)
        created_counts["users"] += 1
        if verbose:
            print(f"  [+] Created User: {engineer.email} (ID: {engineer.id})")

    # 3. Seed Projects, Documents, Chunks, and Evaluations under Admin
    for proj_data in SEED_PROJECTS_DATA:
        project = (
            db.query(Project)
            .filter(Project.name == proj_data["name"], Project.owner_id == admin.id)
            .first()
        )
        if not project:
            project = Project(
                name=proj_data["name"],
                description=proj_data["description"],
                owner_id=admin.id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            created_counts["projects"] += 1
            if verbose:
                print(f"  [+] Created Project: '{project.name}' (ID: {project.id})")

        # Ingest Documents
        for doc_data in proj_data["documents"]:
            doc = (
                db.query(Document)
                .filter(Document.project_id == project.id, Document.name == doc_data["name"])
                .first()
            )
            if not doc:
                content = doc_data["content"]
                doc = Document(
                    project_id=project.id,
                    name=doc_data["name"],
                    file_type="md",
                    file_size=len(content.encode("utf-8")),
                    status="ready",
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)
                created_counts["documents"] += 1

                # Ingest & generate chunks
                chunks = ingest_document(db, document=doc, text=content, chunk_size=500, chunk_overlap=50)
                created_counts["chunks"] += len(chunks)
                if verbose:
                    print(f"      [+] Ingested Document: '{doc.name}' -> {len(chunks)} chunks created")

        # Ingest Evaluation Benchmark Runs
        for eval_data in proj_data["evaluations"]:
            existing_eval = (
                db.query(EvaluationRun)
                .filter(
                    EvaluationRun.project_id == project.id,
                    EvaluationRun.query == eval_data["query"],
                )
                .first()
            )
            if not existing_eval:
                eval_run = EvaluationRun(
                    project_id=project.id,
                    query=eval_data["query"],
                    latency_ms=eval_data["latency_ms"],
                    chunks_found=eval_data["chunks_found"],
                    mode=eval_data["mode"],
                    status=eval_data["status"],
                )
                db.add(eval_run)
                db.commit()
                created_counts["evaluations"] += 1

    return created_counts


def main() -> None:
    """CLI entrypoint for database seeding."""
    parser = argparse.ArgumentParser(
        description="Seed the Vectorly database with enterprise demo data, projects, and benchmarks."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe existing records before seeding.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress informational stdout output.",
    )
    args = parser.parse_args()

    verbose = not args.quiet

    if verbose:
        print("=" * 60)
        print("  VECTORLY DATABASE SEEDER (Production Tool)")
        print("=" * 60)

    # Ensure tables and latest columns exist
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "document_chunks" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("document_chunks")}
        if "embedding" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding TEXT;"))
                conn.commit()

    db = SessionLocal()
    try:
        counts = seed_database(db, reset=args.reset, verbose=verbose)
        if verbose:
            print("-" * 60)
            print("  SEEDING COMPLETE:")
            print(f"  • Users Created:        {counts['users']}")
            print(f"  • Projects Created:     {counts['projects']}")
            print(f"  • Documents Ingested:   {counts['documents']}")
            print(f"  • Chunks Indexed:       {counts['chunks']}")
            print(f"  • Evaluations Recorded: {counts['evaluations']}")
            print("=" * 60)
            print("  Credentials for instant access:")
            print("  - Admin:    admin@vectorly.ai    / AdminPass123!")
            print("  - Engineer: engineer@vectorly.ai / EngineerPass123!")
            print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    main()
