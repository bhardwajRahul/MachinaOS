# React Frontend (Vite)
# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Run development server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3001"]

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

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
