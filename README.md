# CyForesight

CyForesight is a full-stack SOC-style application for tracking indicators of compromise (IOCs), CVEs, MITRE ATT&CK techniques, asset risk, and threat feeds.

## Application Overview

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + TypeScript + Drizzle ORM
- Data layer: PostgreSQL
- Queue/cache: Redis + BullMQ

## Main Features

- Threat dashboard with key metrics and trend views
- IOC management, filtering, and CSV upload
- Asset inventory and risk distribution
- CVE tracking and statistics
- MITRE ATT&CK tactics and top techniques
- Threat feeds and background enrichment/scoring jobs
- JWT authentication with role-based access controls

## Demo Login

- Username: `admin`
- Password: `admin123`

## Run With Docker (Recommended)

### 1. Build and start all services

```bash
docker compose up -d --build
```

### 2. Seed database data for dashboard/API

```bash
docker compose exec backend npm run seed
```

### 3. Open the application

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:10099/api`
- Health check: `http://localhost:10099/api/health`

### 4. Stop services

```bash
docker compose down
```

To remove volumes too:

```bash
docker compose down -v
```

## Local Development (Without Docker)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Backend

```bash
cd tip-backend
npm ci
npm run db:push
npm run seed
npm run dev
```

### Frontend

```bash
npm ci
npm run dev
```

## Docker Files Added

- `docker-compose.yml`: Full multi-service orchestration
- `Dockerfile` (root): Frontend build + Nginx runtime
- `nginx.conf`: SPA routing and `/api` reverse proxy to backend
- `tip-backend/Dockerfile`: Backend image build and start
- `.dockerignore` and `tip-backend/.dockerignore`

## API Routing in Docker

The frontend container proxies all `/api/*` requests to the backend container:

- Browser calls: `http://localhost:3000/api/...`
- Internal target: `http://backend:10099/api/...`

This means frontend and backend work together without hardcoding host ports in browser code.

## Notes

- On backend start, `npm run db:push` runs automatically in the container command.
- Background scheduler and queue workers start with backend.
- External enrichment API keys are optional and can be set in `docker-compose.yml`.
