## DO Manager Feature Roadmap

### Phase 1: Quick UX Wins [COMPLETED!]
*Low complexity, immediate usability improvements*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 1 | **Optimize Add Key Dialog** | Add key type selector (string/JSON/number/boolean), better JSON validation, preview | Small |
| 2 | **Copy Key Name Button** | One-click copy of key names in storage viewer | Tiny |
| 3 | **SQL Query Templates** | Pre-built queries dropdown (SELECT *, table schema, row count) | Small |

---

### Phase 2: Individual Export/Clone [COMPLETED!]
*Build on existing backup infrastructure*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 4 | **Download Instance Button** | Download icon on instance cards - exports state as JSON (already have backup to R2, just need direct download) | Small |
| 5 | **Clone Instance** | Copy button that reads full state and writes to a new instance ID. Uses existing export/import admin hooks | Medium |
| 6 | **Download Namespace Config** | Export namespace settings as JSON for re-import elsewhere | Small |

---

### Phase 3: Multi-Select Infrastructure [COMPLETED!]
*Foundation required for all batch operations*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 7 | **Checkbox Selection** | Add checkboxes to namespace/instance cards, track selection state | Medium |
| 8 | **Selection Toolbar** | Floating/sticky toolbar appears when items selected: count badge, Select All, Deselect All, Clear | Medium |

---

### Phase 4: Batch Operations [COMPLETED!]
*Requires Phase 3 infrastructure*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 9 | **Batch Download (.zip)** | Download multiple instance states as a ZIP file with manifest | Medium |
| 10 | **Batch Delete** | Delete multiple instances with confirmation dialog showing what will be deleted | Medium |
| 11 | **Batch Backup to R2** | Backup multiple instances in one operation with progress tracking | Medium |
| 12 | **Bulk Key Operations** | Multi-select keys within an instance for batch delete and export | Medium |

---

### Phase 5: Import/Export Enhancement
*More complex data handling*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 13 | **JSON Import** | Import keys from JSON file into instance storage | Medium |

---

### Phase 6: Advanced Search
*Backend changes required*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 14 | **Cross-Namespace Key Search** | Search for keys across all instances (requires admin hook calls to each) | Large |
| 15 | **Storage Value Search** | Search within JSON values (limited to indexed/cached data) | Large |

---

### Phase 7: Observability & Monitoring (Variable)
*Documentation and integration heavy*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 16 | **External Logging Guide** | Documentation for integrating with Datadog/Grafana/Sentry via Workers Analytics Engine or custom logging | Docs only |
| 17 | **Webhook Notifications** | Send webhooks on events (backup complete, alarm triggered, error) | Medium |
| 18 | **Health Dashboard** | Visual overview of all DOs: last accessed, storage size, alarm status | Medium |

---

### 💡 Additional Possibilities

| Feature | Description | Priority |
|---------|-------------|----------|
| **Instance Diff** | Compare storage between two instances or two backup points | Nice-to-have |
| **Saved SQL Queries** | Store frequently used queries per namespace | Nice-to-have |
| **Storage Quota Alerts** | Warn when approaching 10GB DO limit | Nice-to-have |
| **Dark Mode Per-Instance** | Color-code instances for visual organization | Low |

---

### Recommended Development Order

```
Thread 1: Phase 1 (Quick UX Wins)
Thread 2: Phase 2 (Individual Export/Clone)  
Thread 3: Phase 3 + 4 (Multi-Select + Batch Ops)
Thread 4: Phase 5 (Import/Export)
Thread 5: Phase 6 + 7 (Search + Observability)
```
