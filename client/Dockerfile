# React Frontend (Vite)
# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (npm ci for faster, deterministic installs)
RUN npm ci

# Copy application code
COPY . .

# Port from environment (default 3000)
ENV VITE_CLIENT_PORT=3000

# Expose default port (actual port set via environment)
EXPOSE 3000

# Run the application
CMD ["npm", "run", "start"]

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (npm ci for faster, deterministic installs)
RUN npm ci

# Copy application code
COPY . .

# Increase Node.js memory limit for large builds (GCP e2-micro has limited RAM)
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Build for production
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
