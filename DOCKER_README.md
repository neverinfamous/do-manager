# Cloudflare Durable Object Manager - Docker

Last Updated December 6, 2025 - Production/Stable v1.0.0

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/do--manager-blue?logo=github)](https://github.com/neverinfamous/do-manager)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/do-manager)](https://hub.docker.com/r/writenotenow/do-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.0.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/do-manager/blob/main/SECURITY.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen.svg)](https://github.com/neverinfamous/do-manager/security/code-scanning)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/do-manager)

Cloudflare Durable Object Manager: Full-featured, self-hosted web app to manage Durable Object namespaces, instances, and storage. Supports automatic namespace discovery, instance inspection, key/value editing, SQL for SQLite-backed DOs, batch operations, alarms, R2 backups, analytics, global search, and job history, with optional GitHub SSO.

**[Live Demo](https://do.adamic.tech/)** • **[GitHub](https://github.com/neverinfamous/do-manager)** • **[Wiki](https://github.com/neverinfamous/do-manager/wiki)** • **[Changelog](https://github.com/neverinfamous/do-manager/wiki/Changelog)** • **[Release Article](https://adamic.tech/articles/do-manager)**

## Tech Stack

**Frontend**: React 19.2.1 | Vite 7.2.6 | TypeScript 5.9.3 | Tailwind CSS | shadcn/ui

**Backend**: Cloudflare Workers + D1 + R2 + Zero Trust

---

## 🎯 Features

### Namespace Management
- Auto-discover DO namespaces from Cloudflare API
- Manual configuration for custom setups
- Clone, download, and batch operations
- System namespace filtering (kv-manager, d1-manager, do-manager)

### Instance Management
- Track DO instances by name or hex ID
- Clone instances with full storage copy
- Color tags for visual organization
- Instance diff — compare storage between two instances

### SQL Console (SQLite-backed DOs)
- Execute raw SQL queries against SQLite storage
- Query Builder with pre-built templates
- Saved queries per namespace
- Query history for quick access

### Multi-Select & Batch Operations
- Batch download (namespaces, instances, keys) as ZIP
- Batch delete with confirmation
- Batch backup to R2 with progress tracking
- Compare exactly 2 instances side-by-side

### Storage Management
- Key search & filter
- Multi-select keys for batch operations
- Import/export keys as JSON
- View/edit storage values with JSON support

### R2 Backup & Restore
- Snapshot DO storage to R2
- Browse backup history
- Restore from any backup with auto-refresh

### Additional Features
- **Alarms** - View, set, and delete alarms with date/time picker
- **Metrics Dashboard** - Request volume, storage usage, CPU time metrics
- **Global Search** - Cross-namespace key and value search
- **Job History** - Comprehensive operation tracking
- **Webhook Notifications** - Event-driven webhooks with HMAC signatures
- **Health Dashboard** - System overview, stale instance detection, storage quota alerts
- **Centralized Error Logging** - Structured error logging with consistent format across all modules

---

## 🚀 Quick Start

### 1. Set Up Metadata Database

The DO Manager requires a metadata database for namespace configs, instance tracking, and job history.

```bash
npx wrangler login
```

```bash
npx wrangler d1 create do-manager-metadata
```

```bash
git clone https://github.com/neverinfamous/do-manager.git
```

```bash
cd do-manager
```

```bash
npx wrangler d1 execute do-manager-metadata --remote --file=worker/schema.sql
```

### 2. Get Cloudflare Credentials

| Credential | Where to Find |
|------------|---------------|
| `ACCOUNT_ID` | Dashboard URL: `dash.cloudflare.com/{ACCOUNT_ID}/...` |
| `API_KEY` | [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → **Workers Scripts Read** + **D1 Edit** |
| `TEAM_DOMAIN` | [Zero Trust](https://one.dash.cloudflare.com/) → Settings → Custom Pages |
| `POLICY_AUD` | Zero Trust → Access → Applications → Your App → AUD tag |

### 3. Run Container

```bash
docker pull writenotenow/do-manager:latest
```

```bash
docker run -d \
  -p 8787:8787 \
  -e ACCOUNT_ID=your_cloudflare_account_id \
  -e API_KEY=your_cloudflare_api_token \
  -e TEAM_DOMAIN=https://yourteam.cloudflareaccess.com \
  -e POLICY_AUD=your_cloudflare_access_aud_tag \
  --name do-manager \
  writenotenow/do-manager:latest
```

Open **http://localhost:8787**

---

## ⬆️ Upgrading

### 1. Update Schema (Required for New Features)

Run this after updating to add new tables (safe to run multiple times):

```bash
npx wrangler d1 execute do-manager-metadata --remote --file=worker/schema.sql
```

### 2. Update Container

```bash
docker pull writenotenow/do-manager:latest
```

```bash
docker stop do-manager && docker rm do-manager
```

```bash
docker run -d \
  -p 8787:8787 \
  -e ACCOUNT_ID=your_account_id \
  -e API_KEY=your_api_token \
  -e TEAM_DOMAIN=https://yourteam.cloudflareaccess.com \
  -e POLICY_AUD=your_aud_tag \
  --name do-manager \
  --restart unless-stopped \
  writenotenow/do-manager:latest
```

---

## 🐋 Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  do-manager:
    image: writenotenow/do-manager:latest
    container_name: do-manager
    ports:
      - "8787:8787"
    environment:
      - ACCOUNT_ID=${ACCOUNT_ID}
      - API_KEY=${API_KEY}
      - TEAM_DOMAIN=${TEAM_DOMAIN}
      - POLICY_AUD=${POLICY_AUD}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8787/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Create `.env`:

```env
ACCOUNT_ID=your_cloudflare_account_id
API_KEY=your_cloudflare_api_token
TEAM_DOMAIN=https://yourteam.cloudflareaccess.com
POLICY_AUD=your_cloudflare_access_aud_tag
```

Run:

```bash
docker-compose up -d
```

Upgrade:

```bash
docker-compose pull && docker-compose up -d
```

---

## 📋 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ACCOUNT_ID` | ✅ | Cloudflare Account ID |
| `API_KEY` | ✅ | API Token with Workers Scripts Read + D1 Edit permission |
| `TEAM_DOMAIN` | ✅ | `https://yourteam.cloudflareaccess.com` |
| `POLICY_AUD` | ✅ | Cloudflare Access Application AUD tag |
| `PORT` | ❌ | Port (default: `8787`) |
| `NODE_ENV` | ❌ | Environment (default: `production`) |

---

## 📊 Container Info

| Property | Value |
|----------|-------|
| Base Image | `node:20-alpine` |
| Size | ~150MB |
| Architectures | `linux/amd64`, `linux/arm64` |
| Port | `8787` |
| User | Non-root (`app`) |
| Health Endpoint | `/health` |

---

## 🏷️ Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v1.0.0` | Specific version (recommended for production) |
| `sha-XXXXXX` | Commit SHA for reproducible builds |

---

## 🔧 Building from Source

```bash
git clone https://github.com/neverinfamous/do-manager.git
```

```bash
cd do-manager
```

```bash
docker build -t do-manager:local .
```

```bash
docker run -d -p 8787:8787 \
  -e ACCOUNT_ID=your_account_id \
  -e API_KEY=your_api_token \
  -e TEAM_DOMAIN=https://yourteam.cloudflareaccess.com \
  -e POLICY_AUD=your_aud_tag \
  do-manager:local
```

---

## 🐞 Troubleshooting

### Container Won't Start

```bash
docker logs do-manager
```

Common causes:
- Missing environment variables
- Port already in use

### Authentication Failures

- Verify `TEAM_DOMAIN` includes `https://`
- Confirm `POLICY_AUD` matches your Access application
- Check API token has **Workers Scripts Read** permission

### Admin Hook Not Working

- Ensure your Durable Object has admin hooks installed
- Use the `do-manager-admin-hooks` NPM package or manual setup
- Set the endpoint URL in namespace settings

### Database Operations Fail

Test your API token:

```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts" \
  -H "Authorization: Bearer ${API_KEY}"
```

📚 **More solutions:** [Wiki - Troubleshooting](https://github.com/neverinfamous/do-manager/wiki/Troubleshooting)

---

## 📚 Additional Resources

- **[Wiki Documentation](https://github.com/neverinfamous/do-manager/wiki)**
- **[GitHub Repository](https://github.com/neverinfamous/do-manager)**
- **[Admin Hooks NPM Package](https://www.npmjs.com/package/do-manager-admin-hooks)**
- **[Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)**
- **[Cloudflare Access Docs](https://developers.cloudflare.com/cloudflare-one/policies/access/)**

---

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/neverinfamous/do-manager/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/neverinfamous/do-manager/discussions)
- 📧 **Email:** admin@adamic.tech

---

## 📄 License

MIT License - see [LICENSE](https://github.com/neverinfamous/do-manager/blob/main/LICENSE)

---

**Made with ❤️ for the Cloudflare and Docker communities**

