# Cloudflare Durable Object Manager

Last Updated December 6, 2025 - v1.0.0

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/do--manager-blue?logo=github)](https://github.com/neverinfamous/do-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.0.0-green)
![Status](https://img.shields.io/badge/status-Stable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/do-manager/blob/main/SECURITY.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-Passing-brightgreen.svg)](https://github.com/neverinfamous/do-manager/security/code-scanning)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/do-manager)

Cloudflare Durable Object Manager: Full-featured, self-hosted web app to manage Durable Object namespaces, instances, and storage. Supports automatic namespace discovery, instance inspection, key/value editing, SQL for SQLite-backed DOs, batch operations, alarms, R2 backups, analytics, global search, and job history, with optional GitHub SSO.

**[Live Demo](https://do.adamic.tech/)** • **[Wiki](https://github.com/neverinfamous/do-manager/wiki)** • **[Changelog](https://github.com/neverinfamous/do-manager/wiki/Changelog)**

## Tech Stack

**Frontend**: React 19.2.1 | TypeScript 5.9.3 | Vite 7.2.6 | Tailwind CSS | shadcn/ui

**Backend**: Cloudflare Workers + D1 + R2 + Zero Trust

---

## 🎯 Features

### Namespace Management
- **Auto-discover** DO namespaces from Cloudflare API
- **Manual configuration** for custom setups
- **Clone namespace** - Duplicate namespace configuration with a new name
- **Download config** - Export namespace settings as JSON
- **System namespace filtering** - Internal DOs (kv-manager, d1-manager, do-manager) are hidden to prevent accidental deletion
- **Search & filter** - Real-time filtering by name, class name, or script name
- Support for SQLite and KV storage backends

### Instance Management
- Track DO instances by name or hex ID
- Create new instances with custom names
- **Clone instance** - Copy all storage data to a new instance
- **Download instance** - Export instance storage as JSON
- **Search & filter** - Real-time filtering by instance name or object ID
- **Color tags** - Color-code instances for visual organization (9 preset colors)
- **Instance diff** - Compare storage between two instances to see differences
- View storage contents (keys/values)

### SQL Console (SQLite-backed DOs)
- Execute raw SQL queries against SQLite storage
- **Query Builder** with pre-built templates:
  | Template | Description |
  |----------|-------------|
  | Select All Rows | `SELECT * FROM table LIMIT 100` |
  | Row Count | `SELECT COUNT(*) FROM table` |
  | Table Schema | `PRAGMA table_info(table)` |
  | List All Tables | `SELECT name FROM sqlite_master` |
  | List Indexes | `PRAGMA index_list(table)` |
  | Sample Rows | Random 10 rows from table |
  | Create Table | Boilerplate for new table creation |
- **Saved queries** - Store frequently used queries per namespace
- Query history - Quick access to recent queries
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
- **Multi-select keys** - Select multiple keys with checkboxes for batch operations
- **Batch export keys** - Export selected keys as JSON with instance/namespace metadata
- **Batch delete keys** - Delete multiple keys at once with confirmation
- **Import keys from JSON** - Upload JSON files to bulk import keys into instance storage
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
- **Event-driven webhooks** - Send HTTP notifications on key events
- **Configurable events** - backup_complete, restore_complete, alarm_set, alarm_deleted, job_failed, batch_complete
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

## 📊 External Logging Integration

DO Manager supports integration with external observability platforms via Cloudflare's native OpenTelemetry export. This allows you to send traces and logs to services like Grafana Cloud, Datadog, Honeycomb, Sentry, and Axiom.

### Option 1: OpenTelemetry Export (Recommended)

Cloudflare Workers natively supports exporting OpenTelemetry-compliant traces and logs to any OTLP endpoint.

**Step 1: Create a destination in Cloudflare Dashboard**

1. Go to [Workers Observability](https://dash.cloudflare.com/?to=/:account/workers-and-pages/observability/pipelines)
2. Click **Add destination**
3. Configure your provider's OTLP endpoint and authentication headers

**Common OTLP Endpoints:**

| Provider | Traces Endpoint | Logs Endpoint |
|----------|-----------------|---------------|
| Grafana Cloud | `https://otlp-gateway-{region}.grafana.net/otlp/v1/traces` | `https://otlp-gateway-{region}.grafana.net/otlp/v1/logs` |
| Honeycomb | `https://api.honeycomb.io/v1/traces` | `https://api.honeycomb.io/v1/logs` |
| Axiom | `https://api.axiom.co/v1/traces` | `https://api.axiom.co/v1/logs` |
| Sentry | `https://{HOST}/api/{PROJECT_ID}/integration/otlp/v1/traces` | `https://{HOST}/api/{PROJECT_ID}/integration/otlp/v1/logs` |
| Datadog | Coming soon | `https://otlp.{SITE}.datadoghq.com/v1/logs` |

**Step 2: Update wrangler.toml**

```toml
[observability]
enabled = true

[observability.traces]
enabled = true
destinations = ["your-traces-destination"]

[observability.logs]
enabled = true
destinations = ["your-logs-destination"]
```

### Option 2: Workers Analytics Engine

For custom metrics and usage-based analytics, use Workers Analytics Engine:

**Step 1: Add binding to wrangler.toml**

```toml
[[analytics_engine_datasets]]
binding = "DO_METRICS"
dataset = "do_manager_metrics"
```

**Step 2: Write data points from your Worker**

```typescript
// Example: Track backup operations
env.DO_METRICS.writeDataPoint({
  blobs: [namespaceId, instanceId, 'backup'],
  doubles: [backupSizeBytes, durationMs],
  indexes: [userId]
});
```

**Step 3: Query via SQL API or Grafana**

```sql
SELECT
  blob1 AS namespace_id,
  SUM(double1) AS total_backup_bytes,
  COUNT(*) AS backup_count
FROM do_manager_metrics
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob1
```

### Option 3: Tail Workers

For real-time log processing, create a Tail Worker:

```typescript
export default {
  async tail(events: TraceItem[]) {
    for (const event of events) {
      // Forward to your logging service
      await fetch('https://your-logging-service.com/ingest', {
        method: 'POST',
        body: JSON.stringify(event),
      });
    }
  }
};
```

Configure in wrangler.toml:

```toml
[[tail_consumers]]
service = "my-tail-worker"
```

### Option 4: Logpush

For structured log export to storage destinations (R2, S3, etc.):

1. Go to [Cloudflare Dashboard > Analytics > Logs](https://dash.cloudflare.com/?to=/:account/logs)
2. Create a Logpush job for Workers Trace Events
3. Select your destination (R2, S3, Azure, GCS, etc.)

---

## 🙈 Hidden System Namespaces

DO Manager automatically hides internal system Durable Objects to prevent accidental deletion:

| Pattern | Description |
|---------|-------------|
| `kv-manager_*` | KV Manager internal DOs (ImportExportDO, BulkOperationDO) |
| `d1-manager_*` | D1 Manager internal DOs |
| `do-manager_*` | DO Manager internal DOs |

These namespaces are filtered during auto-discovery. To modify the filter list, edit `worker/routes/namespaces.ts`:

```typescript
const SYSTEM_DO_PATTERNS = [
  'kv-manager_ImportExportDO',
  'kv-manager_BulkOperationDO',
  'd1-manager_',
  'do-manager_',
  // Add your own patterns here
]
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up)

### Local Development

```bash
# Clone the repository
git clone https://github.com/neverinfamous/do-manager.git
cd do-manager

# Install dependencies
npm install

# Initialize local D1 database
npx wrangler d1 execute do-manager-metadata-dev --local --file=worker/schema.sql

# Start dev servers (2 terminals)
npm run dev                                          # Terminal 1: Frontend (http://localhost:5173)
npx wrangler dev --config wrangler.dev.toml --local  # Terminal 2: Worker (http://localhost:8787)
```

Open **http://localhost:5173** - no auth required, mock data included.

---

## 🔧 Production Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Create D1 Database

```bash
npx wrangler d1 create do-manager-metadata
npx wrangler d1 execute do-manager-metadata --remote --file=worker/schema.sql
```

### 3. Create R2 Bucket (for backups)

```bash
npx wrangler r2 bucket create do-manager-backups
```

### 4. Configure Wrangler

```bash
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml` with your `database_id` from step 2.

### 5. Set Up Cloudflare Access

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Configure authentication (GitHub OAuth, etc.)
3. Create an Access Application for your domain
4. Copy the **Application Audience (AUD) tag**

### 6. Create API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create Custom Token with:
   - **Account → Workers Scripts → Read**
   - **Account → D1 → Edit** (if managing D1-backed DOs)

**Note:** Both API Tokens (Bearer auth) and Global API Keys (X-Auth-Key auth) are supported.

### 7. Set Secrets

```bash
npx wrangler secret put ACCOUNT_ID
npx wrangler secret put API_KEY
npx wrangler secret put TEAM_DOMAIN
npx wrangler secret put POLICY_AUD
```

### 8. Deploy

```bash
npm run build
npx wrangler deploy
```

---

## 🔌 Admin Hook Setup

To manage a Durable Object's storage, you need to add admin hook methods to your DO class. There are two options:

### Option A: NPM Package (Recommended)

Install the admin hooks package:

```bash
npm install do-manager-admin-hooks
```

Extend your Durable Object class:

```typescript
import { withAdminHooks } from 'do-manager-admin-hooks';

export class MyDurableObject extends withAdminHooks() {
  async fetch(request: Request): Promise<Response> {
    // Handle admin requests first (required for DO Manager)
    const adminResponse = await this.handleAdminRequest(request);
    if (adminResponse) return adminResponse;

    // Your custom logic here
    return new Response('Hello from my Durable Object!');
  }
}
```

That's it! The package handles all admin endpoints automatically.

**Configuration options:**

```typescript
export class SecureDO extends withAdminHooks({
  basePath: '/admin',      // Change admin endpoint path (default: '/admin')
  requireAuth: true,       // Require authentication
  adminKey: 'secret-key',  // Admin key for auth
}) {
  // ...
}
```

📦 **[NPM Package](https://www.npmjs.com/package/do-manager-admin-hooks)** • **[GitHub](https://github.com/neverinfamous/do-manager-admin-hooks)**

### Option B: Manual Copy-Paste

Click "Get Admin Hook Code" in the namespace view to generate copy-paste TypeScript code for your DO class.

### Enable in DO Manager

1. Deploy your Worker with admin hooks installed
2. In DO Manager, add your namespace with the **Admin Hook Endpoint URL** (e.g., `https://my-worker.workers.dev`)
3. Admin hooks are automatically enabled when you save with a URL
4. The green "Admin Hook Enabled" badge confirms it's working

**Tip:** You can set the endpoint URL when creating a namespace, or add it later via Settings.

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/list` | GET | List storage keys (KV) or tables (SQLite) |
| `/admin/get?key=X` | GET | Get value for a key |
| `/admin/put` | POST | Set key-value pair |
| `/admin/delete` | POST | Delete a key |
| `/admin/sql` | POST | Execute SQL (SQLite only) |
| `/admin/alarm` | GET/PUT/DELETE | Manage alarms |
| `/admin/export` | GET | Export all storage |
| `/admin/import` | POST | Import data |

---

## 📋 API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/namespaces` | List tracked namespaces |
| `GET /api/namespaces/discover` | Auto-discover from Cloudflare API |
| `POST /api/namespaces` | Add namespace manually |
| `POST /api/namespaces/:id/clone` | Clone namespace with new name |
| `DELETE /api/namespaces/:id` | Remove namespace |
| `GET /api/namespaces/:id/instances` | List instances |
| `POST /api/namespaces/:id/instances` | Track new instance |
| `GET /api/instances/:id/storage` | Get storage contents |
| `PUT /api/instances/:id/storage` | Update storage |
| `POST /api/instances/:id/import` | Import keys from JSON |
| `POST /api/instances/:id/sql` | Execute SQL query |
| `GET /api/instances/:id/export` | Export instance storage as JSON |
| `POST /api/instances/:id/clone` | Clone instance with new name |
| `GET /api/instances/:id/alarm` | Get alarm state |
| `PUT /api/instances/:id/alarm` | Set alarm |
| `DELETE /api/instances/:id/alarm` | Delete alarm |
| `GET /api/instances/:id/backups` | List backups |
| `POST /api/instances/:id/backups` | Create backup |
| `POST /api/instances/:id/restore` | Restore from backup |
| `GET /api/metrics` | Get account metrics |
| `GET /api/jobs` | List job history |
| `GET /api/namespaces/:id/export` | Export namespace config as JSON |
| `POST /api/batch/namespaces/delete` | Batch delete namespaces |
| `POST /api/batch/instances/delete` | Batch delete instances |
| `POST /api/batch/instances/backup` | Batch backup instances to R2 |
| `POST /api/batch/keys/delete` | Log batch delete keys job |
| `POST /api/batch/keys/export` | Log batch export keys job |
| `POST /api/search/keys` | Search for keys across all instances |
| `POST /api/search/values` | Search within storage values |
| `GET /api/health` | Get system health summary |
| `GET /api/webhooks` | List configured webhooks |
| `POST /api/webhooks` | Create a new webhook |
| `PUT /api/webhooks/:id` | Update a webhook |
| `DELETE /api/webhooks/:id` | Delete a webhook |
| `POST /api/webhooks/:id/test` | Send a test webhook |
| `PUT /api/instances/:id/color` | Update instance color tag |
| `POST /api/instances/diff` | Compare storage between two instances |
| `GET /api/namespaces/:id/queries` | List saved SQL queries for namespace |
| `POST /api/namespaces/:id/queries` | Create a saved SQL query |
| `PUT /api/queries/:id` | Update a saved SQL query |
| `DELETE /api/queries/:id` | Delete a saved SQL query |

---

## 📁 Project Structure

```
do-manager/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn components
│   │   ├── layout/       # Header, navigation
│   │   └── features/     # Feature components
│   ├── contexts/         # React contexts (theme)
│   ├── hooks/            # Custom hooks
│   ├── services/         # API clients
│   ├── types/            # TypeScript types
│   └── App.tsx
├── worker/
│   ├── routes/           # API route handlers
│   │   ├── namespaces.ts # Namespace discovery & management
│   │   ├── instances.ts  # Instance tracking & cloning
│   │   ├── storage.ts    # Storage operations
│   │   ├── export.ts     # Instance export/download
│   │   ├── alarms.ts     # Alarm management
│   │   ├── backup.ts     # R2 backup/restore
│   │   ├── batch.ts      # Batch operations
│   │   ├── search.ts     # Cross-namespace search
│   │   ├── metrics.ts    # GraphQL analytics
│   │   ├── jobs.ts       # Job history
│   │   ├── webhooks.ts   # Webhook management
│   │   ├── health.ts     # Health dashboard API
│   │   ├── queries.ts    # Saved SQL queries
│   │   └── diff.ts       # Instance comparison
│   ├── types/            # Worker types
│   ├── utils/            # Utilities (CORS, auth, helpers, webhooks)
│   ├── schema.sql        # D1 schema
│   └── index.ts          # Worker entry
└── ...config files
```

---

## 🐞 Troubleshooting

**"Failed to fetch from Cloudflare API"**
- Verify `ACCOUNT_ID` is correct
- Ensure API token has **Workers Scripts Read** permission
- If using Global API Key, ensure email is correct in `worker/routes/namespaces.ts`

**"Admin hook not configured"**
- Add admin hook methods to your DO class
- Set the endpoint URL in namespace settings
- Ensure your Worker is deployed

**"No namespaces discovered"**
- You may not have any Durable Objects deployed
- System namespaces are filtered by default (see Hidden System Namespaces section)

**"Clone instance creates empty instance"**
- Ensure your admin hooks use the correct export/import format
- Export should return: `{ data: {...}, exportedAt: "...", keyCount: N }`
- Import should accept: `{ data: {...} }`
- The `do-manager-admin-hooks` NPM package handles this automatically

**Authentication loop**
- Check `TEAM_DOMAIN` includes `https://`
- Verify `POLICY_AUD` matches your Access application's AUD tag

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 📞 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/neverinfamous/do-manager/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/neverinfamous/do-manager/discussions)
- 📧 **Email:** admin@adamic.tech

---

**Made with ❤️ for the Cloudflare community**
