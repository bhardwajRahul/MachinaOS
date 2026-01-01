# Python FastAPI Backend
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install aiohttp for WebSocket client (Android relay)
RUN pip install --no-cache-dir aiohttp>=3.9.0

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
CMD ["npm", "run", "start"]
