#!/bin/bash

# MachinaOs Deployment to GCP
# Deploys the workflow automation platform using Docker Compose.
# Builds Docker images on the GCP server to avoid local Docker requirement.
#
# Prerequisites:
#   - SSH access to GCP instance
#   - Docker and Docker Compose installed on GCP instance
#
# Usage:
#   ./deploy.sh [GCP_HOST]

set -e

# Load environment variables from .env if exists
if [ -f "$(dirname "$0")/server/.env" ]; then
    export $(grep -v '^#' "$(dirname "$0")/server/.env" | grep -E '^DEPLOY_|^ANDROID_RELAY_' | xargs)
fi

GCP_HOST="${1:-${DEPLOY_HOST:-user@your-server-ip}}"
SERVICE_NAME="machinaos"
DOMAIN="${DEPLOY_DOMAIN:-your-domain.com}"
REMOTE_DIR="/opt/${SERVICE_NAME}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_PORT="3000"
BACKEND_PORT="3010"

echo "========================================"
echo "Deploying MachinaOs"
echo "========================================"
echo "Host: ${GCP_HOST}"
echo "Domain: ${DOMAIN}"
echo "Frontend Port: ${FRONTEND_PORT}"
echo "Backend Port: ${BACKEND_PORT}"
echo "========================================"

# Step 1: Upload source code
echo "[1/5] Uploading source code to GCP..."
ssh ${GCP_HOST} "mkdir -p /tmp/${SERVICE_NAME}"

# Create tarball of required files (excluding node_modules, __pycache__, etc.)
tar --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='*.pyc' \
    --exclude='.env' \
    --exclude='*.db' \
    --exclude='*.db-*' \
    --exclude='data' \
    --exclude='bin' \
    -czf /tmp/machinaos-src.tar.gz \
    -C "${LOCAL_DIR}" \
    client server docker-compose.prod.yml

scp /tmp/machinaos-src.tar.gz "${GCP_HOST}:/tmp/${SERVICE_NAME}/"

# Upload production .env (prefer .env.production, fallback to .env)
if [ -f "${LOCAL_DIR}/server/.env.production" ]; then
    scp "${LOCAL_DIR}/server/.env.production" "${GCP_HOST}:/tmp/${SERVICE_NAME}/.env"
elif [ -f "${LOCAL_DIR}/server/.env" ]; then
    scp "${LOCAL_DIR}/server/.env" "${GCP_HOST}:/tmp/${SERVICE_NAME}/.env"
fi

# Step 2: Build and deploy on remote
echo "[2/5] Building and deploying on GCP..."
ssh ${GCP_HOST} << 'REMOTE_SCRIPT'
set -e
SERVICE_NAME="machinaos"
DEPLOY_DIR="/opt/${SERVICE_NAME}"

# Stop existing containers
cd ${DEPLOY_DIR} 2>/dev/null && docker-compose down 2>/dev/null || true

# Setup deployment directory
sudo mkdir -p ${DEPLOY_DIR}
sudo chown -R $USER:$USER ${DEPLOY_DIR}

# Extract source code
cd ${DEPLOY_DIR}
tar -xzf /tmp/${SERVICE_NAME}/machinaos-src.tar.gz

# Copy .env file to server directory (where docker-compose expects it)
mkdir -p ${DEPLOY_DIR}/server
[ -f /tmp/${SERVICE_NAME}/.env ] && cp /tmp/${SERVICE_NAME}/.env ${DEPLOY_DIR}/server/.env

# Create docker-compose.yml from prod version
mv docker-compose.prod.yml docker-compose.yml

# Build Docker images on server
echo "Building Docker images on server..."
docker-compose build --no-cache

# Start containers
echo "Starting containers..."
docker-compose up -d

# Cleanup temp files and dangling Docker images
rm -rf /tmp/${SERVICE_NAME}
echo "Cleaning up dangling Docker images..."
docker image prune -f
docker system prune -f --volumes=false
REMOTE_SCRIPT

# Step 3: Setup nginx reverse proxy
echo "[3/5] Configuring nginx..."
ssh ${GCP_HOST} << NGINX_SCRIPT
set -e
DOMAIN="${DOMAIN}"
FRONTEND_PORT="${FRONTEND_PORT}"
BACKEND_PORT="${BACKEND_PORT}"

# Create nginx config
sudo tee /etc/nginx/sites-available/\${DOMAIN} > /dev/null <<NGINX_CONF
server {
    server_name ${DOMAIN};

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3010/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:3010/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Webhook endpoint
    location /webhook/ {
        proxy_pass http://127.0.0.1:3010/webhook/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3010/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/\${DOMAIN} /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Setup SSL
sudo certbot --nginx -d \${DOMAIN} --non-interactive --agree-tos --register-unsafely-without-email || true
NGINX_SCRIPT

# Step 4: Verify
echo "[4/5] Verifying deployment..."
sleep 5
ssh ${GCP_HOST} "cd /opt/${SERVICE_NAME} && docker-compose ps"

# Cleanup local temp files
rm -f /tmp/machinaos-src.tar.gz

echo "========================================"
echo "[5/5] Deployment Complete!"
echo "========================================"
echo "  URL:     https://${DOMAIN}"
echo "  Health:  https://${DOMAIN}/health"
echo "  API:     https://${DOMAIN}/api/"
echo "  WS:      wss://${DOMAIN}/ws/status"
echo "========================================"
echo ""
echo "Useful commands:"
echo "  ssh ${GCP_HOST} 'cd /opt/${SERVICE_NAME} && docker-compose logs -f'"
echo "  ssh ${GCP_HOST} 'cd /opt/${SERVICE_NAME} && docker-compose restart'"
echo "========================================"
