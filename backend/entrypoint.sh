#!/bin/sh
set -e

# Run database migrations to latest revision
echo "[INFO] Applying database migrations via Alembic..."
alembic upgrade head

# Optionally seed database if requested
if [ "$SEED_ON_STARTUP" = "true" ] || [ "$SEED_ON_STARTUP" = "1" ]; then
    echo "[INFO] SEED_ON_STARTUP is enabled. Running database seeder..."
    python -m app.scripts.seed || echo "[WARN] Seeder completed with warnings."
fi

# Hand off execution to the container CMD
echo "[INFO] Starting Vectorly application server: $@"
exec "$@"
