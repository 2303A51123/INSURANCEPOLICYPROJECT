# ==============================================================================
# Dockerfile: Insurance Policy and Claims Management System
# Course: DevOps & Full Stack (Academic Year: 2026-2027)
# Student: PUVATI VAMSHI VARDHAN RAO | Enrolment No: 2303A51123
# ==============================================================================

# Multi-stage optimized production image
FROM node:20-alpine AS production

# Set metadata labels
LABEL maintainer="PUVATI VAMSHI VARDHAN RAO <2303A51123>"
LABEL description="Insurance Policy and Claims Management System"
LABEL version="1.0.0"

# Install curl for container health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifest
COPY package*.json ./

# Install production dependencies if needed (falls back to zero-dep standard lib)
RUN npm install --omit=dev --ignore-scripts --prefer-offline || true

# Copy application source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create persistent storage directories with proper permissions
RUN mkdir -p /app/backend/data /app/backend/uploads && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Switch to non-root user for security best practices
USER appuser

# Expose internal application port
EXPOSE 3000

# Container Healthcheck (Evaluated by Docker engine and orchestration platforms)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "backend/server.js"]
