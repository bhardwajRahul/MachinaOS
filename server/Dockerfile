# Python FastAPI Backend with Node.js for JS/TS execution
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies, uv, and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && pip install uv

# Copy dependency files first for better caching
COPY pyproject.toml .

# Install Python dependencies using uv
RUN uv pip install --system -e .

# Install Playwright browser (chromium) and its system dependencies
RUN playwright install --with-deps chromium

# Copy application code
COPY . .

# Create data directories for SQLite databases
RUN mkdir -p /app/data /app/credentials

# Install Node.js executor dependencies
RUN cd /app/nodejs && npm install

# Create user-packages directory for npm packages
RUN mkdir -p /app/nodejs/user-packages && \
    cd /app/nodejs/user-packages && \
    npm init -y

# Compile Python files to optimized bytecode for faster imports
RUN python -O -m compileall -q -f .

# Default ports (overridden by environment)
ENV PORT=3010
ENV NODEJS_EXECUTOR_PORT=3020
ENV NODEJS_EXECUTOR_HOST=localhost

# Expose default ports
EXPOSE 3010 3020

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD sh -c "curl -f http://localhost:\${PORT}/health || exit 1"

# Make startup script executable
RUN chmod +x /app/start.sh

# Run both Python and Node.js servers
CMD ["/app/start.sh"]
