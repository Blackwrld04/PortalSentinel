# ─── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Dependency manifests only, so source changes do not bust the install cache.
COPY daemon/package*.json ./daemon/
COPY frontend/package*.json ./frontend/

RUN cd daemon && npm ci
RUN cd frontend && npm ci

# Source
COPY daemon ./daemon
COPY frontend ./frontend

RUN cd daemon && npm run build
RUN cd frontend && npm run build

# ─── Daemon runner ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
# Portaldot's RPC is dual-stack; IPv6 can be unreachable in container networks.
ENV NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"

RUN addgroup -S sentinel && adduser -S sentinel -G sentinel \
    && mkdir -p /data && chown sentinel:sentinel /data

# The block journal must survive container restarts and be writable by the
# non-root user; /app itself is root-owned.
ENV STATE_FILE=/data/.sentinel-state.json

# Install only production dependencies, deterministically from the lockfile.
COPY daemon/package.json daemon/package-lock.json ./daemon/
RUN cd daemon && npm ci --omit=dev

COPY --from=builder /app/daemon/dist ./daemon/dist

USER sentinel

# The daemon only exposes the metrics/health API; the dashboard is a separate stage.
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "daemon/dist/index.js"]

# ─── Dashboard runner ──────────────────────────────────────────────────────────
FROM nginx:alpine AS frontend

COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
