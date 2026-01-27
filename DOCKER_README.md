# Cloudflare Durable Object Manager - Docker

Last Updated January 27, 2026 - Production/Stable v1.3.0

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/do--manager-blue?logo=github)](https://github.com/neverinfamous/do-manager)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/do-manager)](https://hub.docker.com/r/writenotenow/do-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.3.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/do-manager/blob/main/SECURITY.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen.svg)](https://github.com/neverinfamous/do-manager/security/code-scanning)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/do-manager)

Cloudflare Durable Object Manager: Full-featured, self-hosted web app to manage Durable Object namespaces, instances, and storage. Supports automatic namespace discovery, instance inspection, key/value editing, SQL for SQLite-backed DOs, batch operations, rich SQL Console, alarms, R2 backups, analytics, global search, and job history, with optional GitHub SSO.

**[Live Demo](https://do.adamic.tech/)** • **[GitHub](https://github.com/neverinfamous/do-manager)** • **[Wiki](https://github.com/neverinfamous/do-manager/wiki)** • **[Changelog](https://github.com/neverinfamous/do-manager/wiki/Changelog)** • **[Release Article](https://adamic.tech/articles/do-manager)**

## Tech Stack

**Frontend**: React 19.2.4 | Vite 7.3.1 | TypeScript 5.9.3 | Tailwind CSS 4.1.17 | shadcn/ui

**Backend**: Cloudflare Workers + D1 + R2 + Zero Trust

---

## 🎯 Features

### Namespace Management

- **Auto-discover** DO namespaces from Cloudflare API
- **Manual configuration** for custom setups
- **List/Grid toggle** - Switch between compact List view (default) and card-based Grid view; preference saved to localStorage
- **Clone namespace** - Configuration only (fast) or **Deep Clone** with all instances and storage (requires admin hooks)
- **Download config** - Export namespace settings as JSON
- **System namespace filtering** - Internal DOs (kv-manager, d1-manager, do-manager) are hidden to prevent accidental deletion
- **Search & filter** - Real-time filtering by name, class name, or script name
- Support for SQLite and KV storage backends

### Instance Management

- Track DO instances by name or hex ID
- Create new instances with custom names
- **List/Grid toggle** - Switch between compact List view (default) and card-based Grid view; preference saved to localStorage
- **Rename instance** - Change the display name of tracked instances
- **Clone instance** - Copy all storage data to a new instance
- **Download instance** - Export instance storage as JSON
- **Search & filter** - Real-time filtering by instance name or object ID
- **Color tags** - Color-code instances for visual organization (9 preset colors)
- **Instance diff** - Compare storage between two instances to see differences
- **Instance migration** - Migrate instances between namespaces with 3 cutover modes (Copy Only, Copy + Freeze, Copy + Delete)
- View storage contents (keys/values)

### SQL Console (SQLite-backed DOs)

- **Enhanced SQL Editor** with Prism.js syntax highlighting and line numbers
- **Real-time validation** with inline error indicators
- **Context-aware autocomplete** for SQL keywords, table names, and columns
- **Hover documentation** for SQL keywords and functions
- **Smart indentation** with bracket/quote auto-pairing
- **Format button** for one-click SQL formatting
- **Copy button** with clipboard feedback
- **Word wrap toggle** and **suggestions toggle** (persisted to localStorage)
- **Quick Queries** dropdown with grouped SQL templates (Information, Select Data, Modify Data, Table Management)
- **Saved queries** - Store frequently used queries per namespace
- **Query history** - Quick access to recent queries
- Results displayed in sortable table format

### Multi-Select & Batch Operations

- **Always-visible checkboxes** - Select namespaces, instances, and storage keys directly from lists
- **Batch download (namespaces)** - Export multiple namespace configs as a ZIP file with manifest
- **Batch download (instances)** - Export multiple instance storage as a ZIP file with manifest
- **Batch download (keys)** - Export selected storage keys as JSON with metadata
- **Batch delete** - Delete multiple namespaces, instances, or storage keys with confirmation
- **Batch backup** - Backup multiple instances to R2 with progress tracking
- **Compare instances** - Select exactly 2 instances to compare storage differences
- **Selection toolbar** - Floating toolbar with count, Select All, and Clear actions
- **Job history integration** - All batch operations are tracked in job history

### Storage Management

- **Key search & filter** - Real-time filtering to find keys quickly
- **Rename keys** - Edit key names directly in the Edit Key dialog
- **Multi-select keys** - Select multiple keys with checkboxes for batch operations
- **Batch export keys** - Export selected keys as JSON with instance/namespace metadata
- **Batch delete keys** - Delete multiple keys at once with confirmation
- **Import keys from JSON** - Upload JSON files or paste JSON directly to bulk import keys into instance storage
- View/edit storage values with JSON support
- Clickable key rows for easy editing

### Admin Hook System

- **NPM package** (`do-manager-admin-hooks`) for easy integration
- Copy-paste template also available for custom setups
- Support for both SQLite and KV backends

### Alarms

- View current alarm state
- Set new alarms with date/time picker
- Delete existing alarms

### R2 Backup & Restore

- Snapshot DO storage to R2
- Browse backup history
- Restore from any backup with auto-refresh

### Metrics Dashboard

- Request volume over time
- Storage usage
- CPU time metrics (average and total)

### Global Search

- **Cross-namespace key search** - Search for storage keys by name across all instances
- **Value search** - Search within JSON values to find data across instances
- **Namespace filtering** - Filter search to specific namespaces
- **Result grouping** - Results grouped by namespace for easy navigation
- **Match highlighting** - Search terms highlighted in results
- **Value previews** - Shows matching portion of values for value searches
- **Job tracking** - All search operations logged to job history

### Job History

- **Comprehensive tracking** - Records all operations including:
  - Namespace: create, delete, clone, download (single & batch)
  - Instance: create, delete, clone, download (single & batch)
  - Storage keys: create/update/delete (single), batch delete, batch export, import
  - Alarms: set, delete
  - Backup/restore operations
  - Batch operations: delete, backup, download (namespaces, instances, keys)
  - **Search operations: key search, value search**
- View status, progress, and timing
- Error details for failed operations
- Filter by status or namespace

### Webhook Notifications

- **Event-driven webhooks** - Send HTTP notifications on key events (13 event types)
- **Configurable events**:
  - Storage: `storage_create`, `storage_update`, `storage_delete`
  - Instance: `instance_create`, `instance_delete`
  - Backup/Restore: `backup_complete`, `restore_complete`
  - Alarms: `alarm_set`, `alarm_deleted`
  - Import/Export: `import_complete`, `export_complete`
  - System: `job_failed`, `batch_complete`
- **HMAC signatures** - Optional secret-based request signing for security
- **Test webhooks** - Verify endpoint connectivity before going live

### Centralized Error Logging

- **Structured error payloads** - Consistent format with module, operation, context, and metadata
- **Module-prefixed error codes** - e.g., `NS_CREATE_FAILED`, `INST_DELETE_FAILED`, `BKP_RESTORE_FAILED`
- **Severity levels** - error, warning, info
- **Webhook integration** - Automatic webhook triggers for job failures
- **Stack trace capture** - Full stack traces logged for debugging

### Health Dashboard

- **System overview** - Total namespaces, instances, and alarms at a glance
- **Stale instance detection** - Identify instances not accessed in 7+ days
- **Storage quota alerts** - Warn when instances approach 10GB DO storage limit (80% warning, 90% critical)
- **Active alarms list** - See all pending alarms with countdown timers
- **Storage summary** - Aggregate storage usage across all instances
- **Recent activity** - Timeline of operations in last 24h/7d

### User Experience

- Dark/Light/System themes
- Responsive design
- Enterprise auth via Cloudflare Access
- **Accessible UI** - Proper form labels and ARIA attributes

---

## 🚀 Quick Start

### 1. Set Up Metadata Database

DO Manager requires a D1 database for namespace configs, instance tracking, and job history.

Authenticate with Cloudflare:

```bash
npx wrangler login
```

Create the metadata database:

```bash
npx wrangler d1 create do-manager-metadata
```

Clone repo and initialize schema:

```bash
git clone https://github.com/neverinfamous/do-manager.git
cd do-manager
npx wrangler d1 execute do-manager-metadata --remote --file=worker/schema.sql
```

### 2. Get Cloudflare Credentials

| Credential    | Where to Find                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ACCOUNT_ID`  | Dashboard URL: `dash.cloudflare.com/{ACCOUNT_ID}/...`                                                                |
| `API_KEY`     | [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → **Workers Scripts Read** + **D1 Edit** |
| `TEAM_DOMAIN` | [Zero Trust](https://one.dash.cloudflare.com/) → Settings → Custom Pages                                             |
| `POLICY_AUD`  | Zero Trust → Access → Applications → Your App → AUD tag                                                              |

### 3. Run Container

```bash
docker pull writenotenow/do-manager:latest

docker run -d \
  -p 8787:8787 \
  -e ACCOUNT_ID=your_cloudflare_account_id \
  -e API_KEY=your_cloudflare_api_token \
  -e TEAM_DOMAIN=https://yourteam.cloudflareaccess.com \
  -e POLICY_AUD=your_cloudflare_access_aud_tag \
  --name do-manager \
  --restart unless-stopped \
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
docker stop do-manager && docker rm do-manager

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

Start:

```bash
docker compose up -d
```

Upgrade:

```bash
docker compose pull && docker compose up -d
```

---

## 📋 Environment Variables

| Variable      | Required | Description                                              |
| ------------- | -------- | -------------------------------------------------------- |
| `ACCOUNT_ID`  | ✅       | Cloudflare Account ID                                    |
| `API_KEY`     | ✅       | API Token with Workers Scripts Read + D1 Edit permission |
| `TEAM_DOMAIN` | ✅       | `https://yourteam.cloudflareaccess.com`                  |
| `POLICY_AUD`  | ✅       | Cloudflare Access Application AUD tag                    |
| `PORT`        | ❌       | Port (default: `8787`)                                   |
| `NODE_ENV`    | ❌       | Environment (default: `production`)                      |

---

## 📊 Container Info

| Property        | Value                        |
| --------------- | ---------------------------- |
| Base Image      | `node:24-alpine`             |
| Size            | ~150MB                       |
| Architectures   | `linux/amd64`, `linux/arm64` |
| Port            | `8787`                       |
| User            | Non-root (`app`)             |
| Health Endpoint | `/health`                    |

---

## 🏷️ Available Tags

| Tag          | Description                                   |
| ------------ | --------------------------------------------- |
| `latest`     | Latest stable release                         |
| `v1.3.0`     | Specific version (recommended for production) |
| `sha-XXXXXX` | Commit SHA for reproducible builds            |

---

## 🔧 Building from Source

```bash
git clone https://github.com/neverinfamous/do-manager.git
cd do-manager

docker build -t do-manager:local .

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
- 📧 **Email:** admin@adamic.tech

---

## 📄 License

MIT License - see [LICENSE](https://github.com/neverinfamous/do-manager/blob/main/LICENSE)

---

**Made with ❤️ for the Cloudflare and Docker communities**
