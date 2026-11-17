# Stage 1: Build dependency wheels
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt

# Stage 2: Hardened Runtime Container
FROM python:3.12-slim AS runner

WORKDIR /app

# Install runtime dependencies (e.g. libpq for PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system group and user
RUN groupadd -r vectorly && useradd -r -g vectorly -d /app -s /sbin/nologin vectorly

# Install wheels from builder
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy application source code and entrypoint
COPY --chown=vectorly:vectorly app /app/app
COPY --chown=vectorly:vectorly alembic.ini /app/alembic.ini
COPY --chown=vectorly:vectorly alembic /app/alembic
COPY --chown=vectorly:vectorly entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER vectorly

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; res = urllib.request.urlopen('http://localhost:8000/health'); exit(0 if res.getcode() == 200 else 1)"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
