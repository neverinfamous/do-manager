# Cloudflare Durable Object Manager

Last Updated November 28, 2025 - Development v0.1.0

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/do--manager-blue?logo=github)](https://github.com/neverinfamous/do-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v0.1.0-green)
![Status](https://img.shields.io/badge/status-Development-yellow)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/do-manager)

A full-featured web application for managing Cloudflare Durable Objects with enterprise-grade authentication via Cloudflare Access (Zero Trust). Auto-discover namespaces, manage instances, view/edit storage, set alarms, and backup state to R2.

**[Live Demo](https://do.adamic.tech/)** • **[Wiki](https://github.com/neverinfamous/do-manager/wiki)** • **[Changelog](https://github.com/neverinfamous/do-manager/wiki/Changelog)**

## Tech Stack

**Frontend**: React 19.2.0 | TypeScript 5.9.3 | Vite 7.2.4 | Tailwind CSS 3.4.18 | shadcn/ui  
**Backend**: Cloudflare Workers + D1 + R2 + Zero Trust

---

## 🎯 Features

### Namespace Management
- **Auto-discover** DO namespaces from Cloudflare API
- **Manual configuration** for custom setups
- **System namespace filtering** - Internal DOs (kv-manager, d1-manager, do-manager) are hidden to prevent accidental deletion
- **Search & filter** - Real-time filtering by name, class name, or script name
- Support for SQLite and KV storage backends

### Instance Management
- Track DO instances by name or hex ID
- Create new instances with custom names
- View storage contents (keys/values)
- SQL console for SQLite-backed DOs

### Storage Management
- **Key search & filter** - Real-time filtering to find keys quickly
- View/edit storage values with JSON support
- Delete keys with confirmation
- Clickable key rows for easy editing

### Admin Hook System
- Copy-paste TypeScript template for your DO classes
- Enable storage viewing, editing, and management
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

### Job History
- **Comprehensive tracking** - Records namespace creation/deletion, instance creation/deletion, key creation/deletion, alarm operations, backup/restore
- View status, progress, and timing
- Error details for failed operations
- Filter by status or namespace

### User Experience
- Dark/Light/System themes
- Responsive design
- Enterprise auth via Cloudflare Access
- **Accessible UI** - Proper form labels and ARIA attributes

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

To manage a Durable Object's storage, you need to add admin hook methods to your DO class. The manager provides a template generator:

1. Navigate to your namespace
2. Click "Admin Hook" button
3. Copy the generated code
4. Paste into your DO class
5. Deploy your Worker
6. Configure the endpoint URL in the manager

### Example Admin Hook Methods

```typescript
// Add to your Durable Object class
async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Admin hook endpoints
  if (url.pathname === '/__admin/list') {
    return Response.json(await this.adminList());
  }
  if (url.pathname === '/__admin/get') {
    const key = url.searchParams.get('key');
    if (!key) return new Response('Missing key', { status: 400 });
    return Response.json(await this.adminGet(key));
  }
  if (url.pathname === '/__admin/put' && request.method === 'POST') {
    const { key, value } = await request.json();
    await this.adminPut(key, value);
    return Response.json({ success: true });
  }
  if (url.pathname === '/__admin/delete' && request.method === 'POST') {
    const { key } = await request.json();
    await this.adminDelete(key);
    return Response.json({ success: true });
  }
  
  // Your normal DO logic here
  return new Response('Hello from DO!');
}

async adminList() {
  if (this.ctx.storage.sql) {
    const tables = this.ctx.storage.sql
      .exec("SELECT name FROM sqlite_master WHERE type='table'")
      .toArray()
      .map((row) => row.name);
    return { tables };
  }
  const entries = await this.ctx.storage.list();
  return { keys: [...entries.keys()] };
}

async adminGet(key: string) {
  return await this.ctx.storage.get(key);
}

async adminPut(key: string, value: unknown) {
  await this.ctx.storage.put(key, value);
}

async adminDelete(key: string) {
  await this.ctx.storage.delete(key);
}

async adminGetAlarm() {
  return await this.ctx.storage.getAlarm();
}

async adminSetAlarm(timestamp: number) {
  await this.ctx.storage.setAlarm(timestamp);
}

async adminDeleteAlarm() {
  await this.ctx.storage.deleteAlarm();
}
```

---

## 📋 API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/namespaces` | List tracked namespaces |
| `GET /api/namespaces/discover` | Auto-discover from Cloudflare API |
| `POST /api/namespaces` | Add namespace manually |
| `DELETE /api/namespaces/:id` | Remove namespace |
| `GET /api/namespaces/:id/instances` | List instances |
| `POST /api/namespaces/:id/instances` | Track new instance |
| `GET /api/instances/:id/storage` | Get storage contents |
| `PUT /api/instances/:id/storage` | Update storage |
| `POST /api/instances/:id/sql` | Execute SQL query |
| `GET /api/instances/:id/alarm` | Get alarm state |
| `PUT /api/instances/:id/alarm` | Set alarm |
| `DELETE /api/instances/:id/alarm` | Delete alarm |
| `GET /api/instances/:id/backups` | List backups |
| `POST /api/instances/:id/backups` | Create backup |
| `POST /api/instances/:id/restore` | Restore from backup |
| `GET /api/metrics` | Get account metrics |
| `GET /api/jobs` | List job history |

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
│   │   ├── instances.ts  # Instance tracking
│   │   ├── storage.ts    # Storage operations
│   │   ├── alarms.ts     # Alarm management
│   │   ├── backup.ts     # R2 backup/restore
│   │   ├── metrics.ts    # GraphQL analytics
│   │   └── jobs.ts       # Job history
│   ├── types/            # Worker types
│   ├── utils/            # Utilities (CORS, auth, helpers)
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
