# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY daemon/package*.json ./daemon/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci && cd daemon && npm ci && cd ../frontend && npm ci

# Copy full source
COPY . .

# Build contracts, daemon and frontend
RUN cd daemon && npm run build
RUN cd frontend && npm run build

# Production Runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/daemon/package*.json ./daemon/
COPY --from=builder /app/daemon/dist ./daemon/dist
COPY --from=builder /app/daemon/node_modules ./daemon/node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose ports if needed
EXPOSE 3000

# Health check against Portaldot V3 EVM RPC
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node daemon/dist/cli.js health || exit 1

# Default command: launch the continuous closed-loop sentinel daemon
CMD ["node", "daemon/dist/index.js"]
