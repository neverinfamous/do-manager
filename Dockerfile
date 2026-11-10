# =============================================================================
# Cloudflare Durable Object Manager - Docker Deployment
# =============================================================================
# Multi-stage build for optimal image size and security
# Production-ready image: ~150MB
# =============================================================================

# -----------------
# Stage 1: Builder
# -----------------
FROM node:26-alpine AS builder

WORKDIR /app

# Upgrade Alpine packages to fix CVE-2025-46394 & CVE-2024-58251 (busybox), CVE-2025-62408 (c-ares), CVE-2026-4738 (zlib), and CVE-2026-107891 (musl)
RUN apk upgrade --no-cache && \
    apk add --no-cache --upgrade c-ares && \
    apk upgrade --no-cache musl musl-utils zlib --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main

# Upgrade npm to latest version to fix CVE-2024-21538 (cross-spawn vulnerability)
RUN npm install -g npm@latest

# Patch npm's own dependencies (P111 - keep versions in sync with package.json overrides)
# npm bundles vulnerable versions of glob, tar, minimatch, and picomatch
RUN cd /tmp && \
    npm pack glob@14.0.4 && \
    npm pack tar@7.5.22 && \
    npm pack @isaacs/brace-expansion@5.0.1 && \
    npm pack brace-expansion@5.0.12 && \
    npm pack @isaacs/nonrecursive-glob-match@1.1.0 && \
    npm pack minimatch@11.0.5 && \
    npm pack picomatch@4.0.7 && \
    npm pack undici@6.29.1 && \
    npm pack ip-address@10.7.6 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/@isaacs/brace-expansion && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/@isaacs/nonrecursive-glob-match && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch && \
    tar -xzf glob-14.0.4.tgz && \
    cp -r package /usr/local/lib/node_modules/npm/node_modules/glob && \
    (mkdir -p /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules && \
     cp -r package /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob || true) && \
    rm -rf package && \
    tar -xzf tar-7.5.22.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tar && \
    tar -xzf isaacs-brace-expansion-5.0.1.tgz && \
    mkdir -p /usr/local/lib/node_modules/npm/node_modules/@isaacs && \
    mv package /usr/local/lib/node_modules/npm/node_modules/@isaacs/brace-expansion && \
    tar -xzf brace-expansion-5.0.12.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    tar -xzf isaacs-nonrecursive-glob-match-1.1.0.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/@isaacs/nonrecursive-glob-match && \
    tar -xzf minimatch-11.0.5.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    tar -xzf picomatch-4.0.7.tgz && \
    mkdir -p /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    tar -xzf undici-6.29.1.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/undici && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/ip-address && \
    tar -xzf ip-address-10.7.6.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/ip-address && \
    rm -rf /tmp/*

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install -g pnpm@11 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# -----------------
# Stage 2: Runtime
# -----------------
FROM node:26-alpine AS runtime

WORKDIR /app

# Upgrade Alpine packages to fix CVE-2025-46394 & CVE-2024-58251 (busybox), CVE-2025-62408 (c-ares), CVE-2026-4738 (zlib), and CVE-2026-107891 (musl)
RUN apk upgrade --no-cache && \
    apk add --no-cache --upgrade c-ares && \
    apk upgrade --no-cache musl musl-utils zlib --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main

# Upgrade npm to latest version to fix CVE-2024-21538 (cross-spawn vulnerability)
RUN npm install -g npm@latest

# Patch npm's own dependencies (P111 - keep versions in sync with package.json overrides)
# npm bundles vulnerable versions of glob, tar, minimatch, and picomatch
RUN cd /tmp && \
    npm pack glob@14.0.4 && \
    npm pack tar@7.5.22 && \
    npm pack @isaacs/brace-expansion@5.0.1 && \
    npm pack brace-expansion@5.0.12 && \
    npm pack @isaacs/nonrecursive-glob-match@1.1.0 && \
    npm pack minimatch@11.0.5 && \
    npm pack picomatch@4.0.7 && \
    npm pack undici@6.29.1 && \
    npm pack ip-address@10.7.6 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/@isaacs/brace-expansion && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/@isaacs/nonrecursive-glob-match && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch && \
    tar -xzf glob-14.0.4.tgz && \
    cp -r package /usr/local/lib/node_modules/npm/node_modules/glob && \
    (mkdir -p /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules && \
     cp -r package /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/glob || true) && \
    rm -rf package && \
    tar -xzf tar-7.5.22.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tar && \
    tar -xzf isaacs-brace-expansion-5.0.1.tgz && \
    mkdir -p /usr/local/lib/node_modules/npm/node_modules/@isaacs && \
    mv package /usr/local/lib/node_modules/npm/node_modules/@isaacs/brace-expansion && \
    tar -xzf brace-expansion-5.0.12.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    tar -xzf isaacs-nonrecursive-glob-match-1.1.0.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/@isaacs/nonrecursive-glob-match && \
    tar -xzf minimatch-11.0.5.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/minimatch && \
    tar -xzf picomatch-4.0.7.tgz && \
    mkdir -p /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules && \
    mv package /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    tar -xzf undici-6.29.1.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/undici && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/ip-address && \
    tar -xzf ip-address-10.7.6.tgz && \
    mv package /usr/local/lib/node_modules/npm/node_modules/ip-address && \
    rm -rf /tmp/*

# Install runtime dependencies only
# Security Notes:
# - Application runtime dependencies: see pnpm-lock.yaml (devDependencies, including any minimatch usage, are not installed due to `pnpm install --prod --frozen-lockfile`)
# - npm CLI bundled dependencies: glob@14.0.4, tar@7.5.22, minimatch@11.0.5, picomatch@4.0.7, undici@6.29.1, ip-address@10.7.6 (npm's own deps, manually patched via P111)
# - glob uncontrolled resource consumption: CVE-2026-118773 (fixed >= 14.0.2)
# - minimatch ReDoS & globparts amplification: GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74, GHSA-g3hv-75wg-m249 (fixed >= 11.0.1)
# - rollup path traversal: GHSA-mw96-cpmx-2vgc (fixed >= 4.59.0 via pnpm update)
# - busybox CVE-2025-46394 & CVE-2024-58251, c-ares CVE-2025-62408, zlib CVE-2026-4738, and musl CVE-2026-107891 fixed via apk upgrade
RUN apk add --no-cache \
    curl \
    ca-certificates

# Create non-root user for security
# Note: Alpine Linux uses GID 1000 for 'users' group, so we use a different GID
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install production dependencies only
RUN npm install -g pnpm@11 && \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune

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

