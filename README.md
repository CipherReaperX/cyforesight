<div align="center">

```
 ██████╗██╗   ██╗███████╗ ██████╗ ██████╗ ███████╗███████╗██╗ ██████╗ ██╗  ██╗████████╗
██╔════╝╚██╗ ██╔╝██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝██║██╔════╝ ██║  ██║╚══██╔══╝
██║      ╚████╔╝ █████╗  ██║   ██║██████╔╝█████╗  ███████╗██║██║  ███╗███████║   ██║
██║       ╚██╔╝  ██╔══╝  ██║   ██║██╔══██╗██╔══╝  ╚════██║██║██║   ██║██╔══██║   ██║
╚██████╗   ██║   ██║     ╚██████╔╝██║  ██║███████╗███████║██║╚██████╔╝██║  ██║   ██║
 ╚═════╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
```

### Cyber Threat Intelligence Platform

*Real-time threat detection · IOC management · MITRE ATT&CK mapping · Live geo threat map*

---

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)
![PRs](https://img.shields.io/badge/PRs-Welcome-orange?style=for-the-badge)

</div>

---

## What is CyForesight?

**CyForesight** is a full-stack Cyber Threat Intelligence (CTI) platform that aggregates, enriches, and visualises threat data in real time. It ingests Indicators of Compromise (IOCs) from multiple live threat feeds, correlates them against your asset inventory, maps them to MITRE ATT&CK techniques, and surfaces anomalies — all in a single, modern dark-theme dashboard.

---

## Feature Highlights

| Module | Capability |
|--------|-----------|
| **Live Dashboard** | Real-time pulse strip (Socket.IO), stat cards, threat pressure index, IOC distribution pie, global geo threat map with country drill-down |
| **IOC Management** | Paginated IOC table, bulk CSV import, JSON/CSV export, severity/type/status filters, copy-to-clipboard, per-IOC enrichment (VirusTotal, AbuseIPDB) |
| **Threat Feeds** | Add/edit/delete feeds (JSON & CSV), per-feed sync, sync-all, pause/resume, health scores, auto-scheduled ingestion via BullMQ |
| **Ingestion Anomaly Detector** | Z-score detection over a rolling 7-day hourly window; flags spikes at μ + 2σ; shows baseline, std-dev and threshold |
| **Incident Workbench** | Create/edit/delete incidents, IOC & asset linking, note timeline, status workflow (New → In Progress → Resolved), auto-cluster from high-risk IOCs |
| **MITRE ATT&CK** | Full tactic/technique matrix, detection coverage heatmap, asset correlation, IOC → TTP mapping |
| **Asset Inventory** | List/grid view, CSV bulk import, per-asset scan, VT reputation recheck, CVE and threat associations |
| **CVE Tracker** | Paginated CVE database, CVSS scoring, exploit & patch status tracking, asset impact count, CSV export |
| **Threat Hunting** | KQL-compatible query builder, multi-source hunts (IOCs + Assets + CVEs), save & schedule queries, run history |
| **Recon Tools** | WHOIS, DNS, GeoIP, SSL certificate lookups |
| **Reports** | Template-based report generation and download |
| **Integrations** | Webhook, Slack, SIEM integrations with live test and config persistence |
| **Settings** | General, notifications, user management, data sources, security (password change, audit log), API keys |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│   React 18 · Vite · TailwindCSS · Recharts · React Query   │
│                    Socket.IO client                         │
└────────────────────┬────────────────────────────────────────┘
                     │  HTTP /api  +  WS /socket.io
                     │  (Vite proxy in dev · nginx in prod)
┌────────────────────▼────────────────────────────────────────┐
│                   Express API Server (:9999)                 │
│   TypeScript · Drizzle ORM · Zod · JWT auth · BullMQ        │
│   Socket.IO server · geoip-lite · VirusTotal · AbuseIPDB    │
└─────────┬────────────────────────────┬───────────────────────┘
          │                            │
┌─────────▼──────────┐    ┌────────────▼────────────┐
│   PostgreSQL 16     │    │      Redis 7             │
│   (Drizzle schema) │    │  (BullMQ job queues)     │
└─────────────────────┘    └──────────────────────────┘
```

---

## Tech Stack

**Frontend**
- React 18 with `startTransition` for non-blocking socket updates
- Vite 5 with HMR and path aliasing (`@/`)
- TailwindCSS — dark theme with custom slate/cyan palette
- Recharts — line, area, bar, pie charts
- React Query (TanStack) — server state, cache invalidation
- Socket.IO client — WebSocket-only transport
- React Router v6
- Sonner — toast notifications

**Backend**
- Express 4 + TypeScript
- Drizzle ORM over PostgreSQL 16
- BullMQ + Redis — feed fetch job queue
- Socket.IO server — real-time events (`dashboard:pulse`, `ioc:new`, `feed:synced`, `incident:*`)
- JWT authentication with role-based access (`admin`, `analyst`, `viewer`)
- geoip-lite — offline IP geolocation at insert time
- Zod — request validation schemas
- Winston — structured logging

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| PostgreSQL | 16+ |
| Redis | 7+ |
| npm | 10+ |

### 1 — Clone & install

```bash
git clone https://github.com/CipherReaperX/cyforesight.git
cd cyforesight

# Frontend dependencies
npm install

# Backend dependencies
cd tip-backend && npm install
```

### 2 — Configure environment

Create `tip-backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cyforesight
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-change-this
CORS_ORIGIN=http://localhost:3000

# Optional enrichment APIs
VIRUSTOTAL_API_KEY=
ABUSEIPDB_API_KEY=
ALIENVAULT_API_KEY=
```

Create `.env` in the project root:

```env
VITE_API_BASE_URL=/api
```

### 3 — Database setup

```bash
cd tip-backend
npm run db:push      # push Drizzle schema to Postgres
npm run db:seed      # optional: seed MITRE ATT&CK data
```

### 4 — Run in development

```bash
# Terminal 1 — backend (port 9999)
cd tip-backend && npm run dev

# Terminal 2 — frontend (port 3000)
npm run dev
```

Open **http://localhost:3000** — Vite proxies `/api` and `/socket.io` to the backend on port 9999.

### Default credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |

> **Important:** Change the default password immediately in **Settings → Security**.

---

## Project Structure

```
cyforesight/
├── src/                          # React frontend
│   ├── components/
│   │   ├── layout/               # TopBar, Sidebar, MainLayout
│   │   ├── ui/                   # Card, Button, Badge, Table, Input…
│   │   ├── AnomalyPanel.tsx      # Z-score ingestion anomaly detector
│   │   ├── GeoMap.tsx            # Leaflet world threat map
│   │   └── NotificationPanel.tsx
│   ├── hooks/                    # React Query data hooks
│   ├── pages/                    # Route-level page components
│   ├── providers/
│   │   └── SocketProvider.tsx    # Socket.IO context + startTransition
│   └── lib/
│       └── api.ts                # Axios client with JWT interceptor
│
└── tip-backend/src/
    ├── controllers/              # Express request handlers
    ├── services/                 # Business logic
    ├── routes/                   # Express routers
    ├── models/schema.ts          # Drizzle table definitions
    ├── validators/               # Zod schemas
    ├── jobs/feedFetch.job.ts     # BullMQ worker for feed ingestion
    ├── services/socket.service.ts# Socket.IO init + notification buffer
    └── config/                   # DB, Redis, logger
```

---

## API Overview

All endpoints require `Authorization: Bearer <token>` except `/api/auth/login`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login` · `POST /auth/change-password` · `GET /auth/audit-log` |
| IOCs | `GET /iocs` · `POST /iocs` · `PUT /iocs/:id` · `DELETE /iocs/:id` · `GET /iocs/anomalies` · `POST /iocs/upload-csv` · `GET /iocs/export` |
| Feeds | `GET /feeds` · `POST /feeds` · `POST /feeds/:id/sync` · `POST /feeds/sync-all` · `POST /feeds/:id/pause` |
| Dashboard | `GET /dashboard/overview` · `GET /dashboard/geo-threats` · `POST /dashboard/invalidate-cache` |
| Incidents | `GET /incidents` · `POST /incidents` · `PATCH /incidents/:id` · `DELETE /incidents/:id` · `POST /incidents/bootstrap` |
| Assets | `GET /assets` · `POST /assets` · `POST /assets/:id/scan` · `POST /assets/map-iocs` · `GET /assets/export` |
| CVEs | `GET /cves` · `PATCH /cves/:id` · `POST /cves/scan-assets` · `GET /cves/export` |
| MITRE | `GET /mitre/tactics` · `GET /mitre/techniques` · `GET /mitre/coverage` · `POST /mitre/map-iocs` |
| Hunting | `POST /hunting/run` · `POST /hunting/queries` · `GET /hunting/queries` · `POST /hunting/automation/run` |
| Settings | `GET/PUT /settings` · `POST /settings/api-keys` · `GET/PUT /settings/notification-prefs` |

---

## Real-time Events

Socket.IO with WebSocket-only transport. All client handlers run inside React 18 `startTransition` to keep the UI responsive.

| Event | Direction | Trigger |
|-------|-----------|---------|
| `dashboard:pulse` | Server → Client | Every 5 seconds — live IOC count, threats, assets at risk |
| `ioc:new` | Server → Client | New IOCs ingested from a feed sync |
| `feed:synced` | Server → Client | Feed sync job completed |
| `incident:created` | Server → Client | New incident created |
| `incident:updated` | Server → Client | Incident status or data changed |
| `notification:new` | Server → Client | In-app notification pushed |
| `pulse:request` | Client → Server | Request an immediate pulse snapshot |

---

## Security

- JWT authentication with configurable expiry
- Role-based access control — `admin` · `analyst` · `viewer`
- Bcrypt password hashing
- Zod schema validation on all mutating endpoints
- Rate limiting on authentication routes
- CORS locked to configured origins
- Dependabot vulnerability alerts enabled on this repository

---

## License

MIT © 2025 [CipherReaperX](https://github.com/CipherReaperX)

---

<div align="center">

*Built with precision. Designed for defenders.*

</div>
