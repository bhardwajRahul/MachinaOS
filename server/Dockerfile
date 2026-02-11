# Python FastAPI Backend (CPU-only, no CUDA)
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
# Use requirements-docker.txt which excludes CUDA-heavy dependencies
COPY requirements-docker.txt .

# Install Python dependencies (CPU-only)
# This avoids sentence-transformers/PyTorch CUDA which adds ~5GB to image
RUN pip install --no-cache-dir -r requirements-docker.txt

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Compile Python files to optimized bytecode for faster imports
# Keep .py files since Python imports require them or __pycache__/*.pyc
# -O: optimize (remove assert statements)
# -q: quiet mode
# -f: force rebuild
RUN python -O -m compileall -q -f .

# Default port (overridden by environment)
ENV PORT=3010

# Expose default port (actual port set via environment)
EXPOSE 3010

# Health check using shell for variable expansion
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD sh -c "curl -f http://localhost:\${PORT}/health || exit 1"

# Run the application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3010"]
