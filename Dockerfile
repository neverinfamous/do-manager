# =============================================================================
# Cloudflare Durable Object Manager - Docker Deployment
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:24-alpine AS builder

WORKDIR /app

# Upgrade Alpine packages to fix CVE-2025-46394 & CVE-2024-58251 (busybox 1.37.0-r19 -> 1.37.0-r20)
# Also upgrade c-ares to fix CVE-2025-62408 (1.34.5-r0 -> 1.34.6-r0)
RUN apk upgrade --no-cache && \
    apk add --no-cache --upgrade c-ares

# Upgrade npm to latest version to fix CVE-2024-21538 (cross-spawn vulnerability)
RUN npm install -g npm@latest

# Patch npm's own dependencies (P111 - keep versions in sync with package.json overrides)
# npm bundles vulnerable versions of glob, tar, and minimatch
RUN cd /tmp && \
    npm pack glob@11.1.0 && \
    npm pack tar@7.5.8 && \
    npm pack minimatch@10.2.4 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob && \
    tar -xzf glob-11.1.0.tgz && \
    cp -r package /usr/local/lib/node_modules/npm/node_modules/glob && \
    (mkdir -p /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules && \
     cp -r package /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob || true) && \
    rm -rf package && \
    tar -xzf tar-7.5.8.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tar && \
    tar -xzf minimatch-10.2.4.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    rm -rf /tmp/*

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:24-alpine AS runtime

WORKDIR /app

# Upgrade Alpine packages to fix CVE-2025-46394 & CVE-2024-58251 (busybox 1.37.0-r19 -> 1.37.0-r20)
# Also upgrade c-ares to fix CVE-2025-62408 (1.34.5-r0 -> 1.34.6-r0)
RUN apk upgrade --no-cache && \
    apk add --no-cache --upgrade c-ares

# Upgrade npm to latest version to fix CVE-2024-21538 (cross-spawn vulnerability)
RUN npm install -g npm@latest

# Patch npm's own dependencies (P111 - keep versions in sync with package.json overrides)
# npm bundles vulnerable versions of glob, tar, and minimatch
RUN cd /tmp && \
    npm pack glob@11.1.0 && \
    npm pack tar@7.5.8 && \
    npm pack minimatch@10.2.4 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob && \
    tar -xzf glob-11.1.0.tgz && \
    cp -r package /usr/local/lib/node_modules/npm/node_modules/glob && \
    (mkdir -p /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules && \
     cp -r package /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob || true) && \
    rm -rf package && \
    tar -xzf tar-7.5.8.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tar && \
    tar -xzf minimatch-10.2.4.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    rm -rf /tmp/*

# Install runtime dependencies only
# Security Notes:
# - Application dependencies: glob@11.1.0, tar@7.5.8, minimatch@10.2.4 (patched via package.json overrides)
# - npm CLI dependencies: glob@11.1.0, tar@7.5.8, minimatch@10.2.4 (manually patched via P111)
# - minimatch ReDoS: GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (fixed >= 10.2.3)
# - rollup path traversal: GHSA-mw96-cpmx-2vgc (fixed >= 4.59.0 via npm audit fix)
# - busybox CVE-2025-46394 & CVE-2024-58251 fixed via apk upgrade
# - c-ares CVE-2025-62408 fixed via explicit upgrade
RUN apk add --no-cache \
    curl \
    ca-certificates

# Create non-root user for security
# Note: Alpine Linux uses GID 1000 for 'users' group, so we use a different GID
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/wrangler.toml.example ./wrangler.toml.example

# Set ownership to non-root user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Expose Wrangler dev server port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8787/health || exit 1

# Default command: Run Wrangler in development mode
# Override with specific commands for production deployment
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]

