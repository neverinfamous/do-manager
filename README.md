# Cloudflare Durable Object Manager

Last Updated November 2025 - Development v0.1.0

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v0.1.0-green)
![Status](https://img.shields.io/badge/status-Development-yellow)
[![Type Safety](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/do-manager)

A full-featured web application for managing Cloudflare Durable Objects with enterprise-grade authentication via Cloudflare Access (Zero Trust).

## Tech Stack

**Frontend**: React 19 | TypeScript 5.6 | Vite 6 | Tailwind CSS | shadcn/ui  
**Backend**: Cloudflare Workers + D1 + R2 + Zero Trust

---

## Features

### Namespace Management
- Auto-discover DO namespaces from Cloudflare API
- Manual namespace configuration
- Support for SQLite and KV storage backends

### Instance Management
- Track DO instances by name or hex ID
- View storage contents (keys/values)
- SQL console for SQLite-backed DOs

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
- Restore from any backup

### Metrics Dashboard
- Request volume over time
- Storage usage
- CPU time percentiles (P50, P95, P99)

### Job History
- Track all operations
- View status and progress
- Error details

---

## Quick Start

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
npm run dev                                    # Terminal 1: Frontend (http://localhost:5173)
npx wrangler dev --config wrangler.dev.toml --local  # Terminal 2: Worker (http://localhost:8787)
```

Open **http://localhost:5173** - no auth required, mock data included.

---

## Production Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Create D1 Database

```bash
npx wrangler d1 create do-manager-metadata
npx wrangler d1 execute do-manager-metadata --remote --file=worker/schema.sql
```

### 3. Create R2 Bucket (Optional, for backups)

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

### 6. Set Secrets

```bash
npx wrangler secret put ACCOUNT_ID
npx wrangler secret put API_KEY
npx wrangler secret put TEAM_DOMAIN
npx wrangler secret put POLICY_AUD
```

### 7. Deploy

```bash
npm run build
npx wrangler deploy
```

---

## Admin Hook Setup

To manage a Durable Object's storage, you need to add admin hook methods to your DO class. The manager provides a template generator:

1. Navigate to your namespace
2. Click "Admin Hook" tab
3. Copy the generated code
4. Paste into your DO class
5. Deploy your Worker
6. Configure the endpoint URL in the manager

### Example Admin Hook Methods

```typescript
// Add to your Durable Object class
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
```

---

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/namespaces` | List tracked namespaces |
| `GET /api/namespaces/discover` | Auto-discover from Cloudflare API |
| `POST /api/namespaces` | Add namespace manually |
| `GET /api/namespaces/:id/instances` | List instances |
| `POST /api/namespaces/:id/instances` | Track new instance |
| `GET /api/instances/:id/storage` | Get storage contents |
| `POST /api/instances/:id/sql` | Execute SQL query |
| `GET /api/instances/:id/alarm` | Get alarm state |
| `PUT /api/instances/:id/alarm` | Set alarm |
| `POST /api/instances/:id/backups` | Create backup |
| `GET /api/metrics` | Get account metrics |
| `GET /api/jobs` | List job history |

---

## Project Structure

```
do-manager/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn components
│   │   ├── layout/       # Header, navigation
│   │   └── features/     # Feature components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   ├── services/         # API clients
│   ├── types/            # TypeScript types
│   └── App.tsx
├── worker/
│   ├── routes/           # API route handlers
│   ├── types/            # Worker types
│   ├── utils/            # Utilities
│   ├── schema.sql        # D1 schema
│   └── index.ts          # Worker entry
└── ...config files
```

---

## Troubleshooting

**"Failed to list namespaces"**
- Verify `ACCOUNT_ID` is correct
- Ensure API token has Workers Scripts Read permission

**"Admin hook not configured"**
- Add admin hook methods to your DO class
- Set the endpoint URL in namespace settings

**Authentication loop**
- Check `TEAM_DOMAIN` includes `https://`
- Verify `POLICY_AUD` matches your Access application

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Support

- **Bug Reports:** [GitHub Issues](https://github.com/neverinfamous/do-manager/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/neverinfamous/do-manager/discussions)
- **Email:** admin@adamic.tech

---

**Made with ❤️ for the Cloudflare community**
