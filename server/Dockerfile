# Python FastAPI Backend
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies and uv
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/* \
    && pip install uv

# Copy dependency files first for better caching
COPY pyproject.toml .

# Install Python dependencies using uv
RUN uv pip install --system -e .

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Compile Python files to optimized bytecode for faster imports
RUN python -O -m compileall -q -f .

# Default port (overridden by environment)
ENV PORT=3010

# Expose default port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD sh -c "curl -f http://localhost:\${PORT}/health || exit 1"

# Run the application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3010"]
