# TaskFlow — Deployment Guide

> **Version:** 0.2.0
> **Last Updated:** July 2025
> **Stack:** Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma ORM (SQLite) · Bun

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Variables](#3-environment-variables)
4. [Installation & Setup](#4-installation--setup)
5. [Production Build](#5-production-build)
6. [Deployment Options](#6-deployment-options)
7. [Database Management](#7-database-management)
8. [Security Notes](#8-security-notes)
9. [Maintenance](#9-maintenance)
10. [Architecture Overview](#10-architecture-overview)
11. [Resolved Issues & Fixes](#11-resolved-issues--fixes)
12. [Production Readiness Checklist](#12-production-readiness-checklist)

---

## 1. Project Overview

**TaskFlow** is a full-featured project management and team collaboration platform built with a modern React stack. It provides role-based dashboards, kanban boards, messaging, time tracking, screenshot monitoring, onboarding workflows, and calendar notes.

### User Roles

| Role | Description |
|---|---|
| **admin** | Full system access — user management, project/task CRUD, onboarding review, analytics, messaging |
| **team** | Project execution — kanban boards, task management, time tracking, auto-screenshots, messaging |
| **client** | Client-facing view — multi-step onboarding wizard, project tracking, task visibility, messaging |
| **training** | (Reserved for future use) |

### Key Features

- **Kanban Board** — Drag-and-drop task management with dnd-kit
- **Time Tracking** — Start/stop timers, manual entries, CSV export
- **Auto-Screenshot** — Configurable periodic screenshots with countdown overlay
- **Screenshot Reports** — ZIP export of screenshots with metadata
- **Onboarding Wizard** — Multi-step client onboarding forms with file upload and review workflow
- **Messaging** — Direct and group messages per project
- **Calendar Notes** — Per-user daily notes with color tags
- **Activity Logging** — Automatic activity tracking across all actions

---

## 2. Prerequisites

| Software | Minimum Version | Purpose |
|---|---|---|
| **Node.js** | 18+ (LTS recommended) | Next.js runtime, Prisma tooling |
| **Bun** | 1.0+ | Package manager, script runner, production server |
| **Git** | 2.30+ | Source code management |
| **SQLite3** | 3.35+ | Database engine (Prisma bundles a driver, but CLI tools are useful) |
| **Caddy** (optional) | 2.7+ | Reverse proxy with automatic HTTPS |

### Quick Install (Ubuntu/Debian)

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Bun
curl -fsSL https://bun.sh/install | bash

# SQLite3 CLI
sudo apt-get install -y sqlite3

# Caddy (for reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

### Quick Install (macOS)

```bash
brew install node bun sqlite caddy
```

---

## 3. Environment Variables

Create a `.env` file in the project root. The only required variable is:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | SQLite connection string. Format: `file:./db/custom.db` or an absolute path like `file:/app/data/taskflow.db` |
| `NODE_ENV` | No | `development` | Set to `production` when running the production server |

### Example `.env` File

```env
# Database (SQLite — adjust path as needed for your deployment)
DATABASE_URL=file:/home/z/my-project/db/custom.db

# Optional: set when running production
NODE_ENV=production
```

> **Note:** The `DATABASE_URL` uses the Prisma SQLite format. The `file:` prefix is required. For Docker deployments, use a path inside the container's mounted volume (e.g., `file:/app/data/taskflow.db`).

---

## 4. Installation & Setup

### 4.1 Clone the Repository

```bash
git clone <repository-url> taskflow
cd taskflow
```

### 4.2 Install Dependencies

```bash
bun install
```

This installs all dependencies from `package.json` including Next.js 16, Prisma, dnd-kit, shadcn/ui components, recharts, and other libraries.

### 4.3 Configure Environment

```bash
cp .env.example .env  # if an example file exists
# Edit .env and set DATABASE_URL
```

Create/edit `.env` with the database path:

```env
DATABASE_URL=file:/absolute/path/to/db/taskflow.db
```

### 4.4 Database Setup

Ensure the directory for the SQLite database exists:

```bash
mkdir -p db
```

Generate the Prisma client and push the schema to the database:

```bash
# Generate Prisma client
bunx prisma generate

# Create/update database tables (no migration files needed)
bunx prisma db push
```

### 4.5 Seed the Database

The seed script creates the initial admin account:

- **Email:** `admin@yberdigitals.com`
- **Password:** `admin123`

```bash
bun run prisma/seed.ts
```

> **Important:** Change the admin password immediately after first login in production.

### 4.6 Start Development Server

```bash
bun run dev
```

The application starts on `http://localhost:3000`. The dev server provides hot-reload and outputs logs to both the terminal and `dev.log`.

---

## 5. Production Build

### 5.1 Build the Application

```bash
bun run build
```

This runs:
1. `next build` — Compiles the Next.js app in standalone output mode
2. Copies `.next/static` and `public/` into the standalone output directory

The standalone build is output to `.next/standalone/` and is self-contained (includes all necessary dependencies).

### 5.2 Start the Production Server

```bash
bun start
```

This runs the standalone server at `.next/standalone/server.js` with `NODE_ENV=production`. Logs are written to both the terminal and `server.log`.

The server listens on port **3000** by default. Override with:

```bash
PORT=8080 bun start
```

---

## 6. Deployment Options

### 6.1 Vercel Deployment

> **Caveat:** TaskFlow uses SQLite, which is a file-based database. Vercel's serverless environment has an ephemeral filesystem — the database will be lost on each deployment and between function invocations. For Vercel, you would need to migrate to a managed database (e.g., PostgreSQL via Vercel Postgres or a third-party provider).

If you still want to deploy to Vercel for frontend/preview purposes:

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel

# Production deploy
vercel --prod
```

**Required Vercel configuration changes for SQLite:**

1. Add `DATABASE_URL` in Vercel Environment Variables settings
2. Switch the Prisma provider to a cloud database (PostgreSQL/MySQL)
3. Update `prisma/schema.prisma` and re-run `prisma generate` + `prisma db push`

### 6.2 Self-Hosted (Node.js / Bun)

This is the **recommended** deployment method since it preserves the SQLite database.

#### Using a Process Manager (systemd)

Create `/etc/systemd/system/taskflow.service`:

```ini
[Unit]
Description=TaskFlow Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/taskflow
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:/opt/taskflow/data/taskflow.db
ExecStart=/home/<user>/.bun/bin/bun .next/standalone/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable taskflow
sudo systemctl start taskflow

# Check status
sudo systemctl status taskflow
sudo journalctl -u taskflow -f
```

#### Using PM2 (alternative)

```bash
# Install PM2 globally
bun add -g pm2

# Start the application
pm2 start .next/standalone/server.js --name taskflow

# Save and configure for auto-start
pm2 save
pm2 startup
```

#### Reverse Proxy with Caddy

The project includes a `Caddyfile` for reverse proxy configuration. Adapt it for your domain:

```
taskflow.example.com {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
```

```bash
# Validate config
caddy validate --config Caddyfile

# Reload
caddy reload --config /path/to/Caddyfile
```

### 6.3 Docker Deployment

Create a `Dockerfile` in the project root:

```dockerfile
# ---- Build Stage ----
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client
FROM base AS prisma
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY src/lib/auth.ts ./src/lib/auth.ts
RUN bunx prisma generate

# Build the Next.js application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ---- Production Stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema and seed for runtime DB operations
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/src/lib/auth.ts ./src/lib/auth.ts

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV DATABASE_URL=file:/app/data/taskflow.db
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
```

Build and run:

```bash
# Build the image
docker build -t taskflow .

# Create a data volume for persistent SQLite storage
docker volume create taskflow-data

# Run the container
docker run -d \
  --name taskflow \
  -p 3000:3000 \
  -v taskflow-data:/app/data \
  -e DATABASE_URL=file:/app/data/taskflow.db \
  taskflow

# Initialize the database (first run only)
docker exec taskflow bunx prisma db push
docker exec taskflow bun run prisma/seed.ts
```

#### Docker Compose (optional)

```yaml
services:
  taskflow:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - taskflow-data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/taskflow.db
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  taskflow-data:
```

```bash
docker compose up -d
```

---

## 7. Database Management

### 7.1 Schema Overview

TaskFlow uses SQLite via Prisma ORM with **16 models**:

`Session`, `User`, `Screenshot`, `ScreenshotConfig`, `Project`, `ProjectMember`, `ClientProject`, `Task`, `TaskAssignment`, `Subtask`, `Comment`, `OnboardingForm`, `Onboarding`, `Message`, `MessageGroup`, `GroupMember`, `ActivityLog`, `CalendarNote`, `TimeEntry`

### 7.2 Backup Procedures

SQLite is a single-file database, making backups straightforward:

```bash
# Online backup using SQLite's built-in .backup command
sqlite3 /path/to/taskflow.db ".backup '/path/to/backups/taskflow-$(date +%Y%m%d-%H%M%S).db'"

# Simple file copy (safe when no writes are occurring)
cp /path/to/taskflow.db "/path/to/backups/taskflow-$(date +%Y%m%d-%H%M%S).db"

# Automated daily backup (cron)
0 2 * * * sqlite3 /opt/taskflow/data/taskflow.db ".backup '/opt/taskflow/backups/taskflow-$(date +\%Y\%m\%d).db'"
```

> **Important:** Also back up the `public/uploads/` directory if file uploads are in use.

### 7.3 Migration Steps

TaskFlow uses `prisma db push` for schema management (no migration files):

```bash
# After pulling code changes with schema updates:
bunx prisma generate          # Regenerate the Prisma client
bunx prisma db push           # Apply schema changes to the database
```

> **Warning:** `prisma db push` does not create migration history. For production systems requiring migration rollbacks, consider switching to `prisma migrate dev` / `prisma migrate deploy`.

### 7.4 Restore Procedures

```bash
# Stop the application
sudo systemctl stop taskflow

# Restore from backup
cp /path/to/backups/taskflow-20250701.db /opt/taskflow/data/taskflow.db

# Restart the application
sudo systemctl start taskflow
```

### 7.5 Seeding

```bash
# Run the seed script (creates admin account if it doesn't exist)
bun run prisma/seed.ts
```

The seed script is idempotent — it checks if the admin account exists before creating it.

---

## 8. Security Notes

### 8.1 Session-Based Authentication

- Authentication uses **database-backed sessions** with cryptographically random 256-bit tokens
- Sessions expire after **7 days** by default (`SESSION_DURATION_DAYS` in `src/lib/session.ts`)
- Tokens are transmitted via `Authorization: Bearer <token>` header, `x-session-token` header, or `session-token` cookie
- Expired sessions are automatically deleted on validation
- Users with `status: 'inactive'` are blocked from authentication

### 8.2 Role-Based Access Control (RBAC)

All API routes enforce authentication and role checks:

| Middleware | Purpose | Used In |
|---|---|---|
| `requireAuth()` | Validates session, returns user | All authenticated routes |
| `requireAdmin()` | Requires `role: 'admin'` | Admin-only routes |

Protected API routes include:
- `/api/admin/*` — Admin-only
- `/api/users/*` — Admin-only
- `/api/projects/*` — Authenticated users
- `/api/tasks/*` — Authenticated users
- `/api/screenshots/*` — Authenticated (owner or admin)
- `/api/time-entries/*` — Authenticated (owner)
- `/api/messages/*` — Authenticated
- `/api/onboarding/*` — Role-dependent access
- `/api/calendar-notes/*` — Authenticated (owner)

### 8.3 File Upload Handling

- File uploads are stored in `public/uploads/`
- The upload rewrite rule (`/upload/:path*` → `/api/upload/serve/:path*`) routes file requests through an API handler
- **In production**, restrict upload file types and sizes at the reverse proxy level
- Consider moving uploads to an object storage service (S3, GCS) for scalability

### 8.4 API Route Protection

- All API routes use `try/catch` with `handleApiError()` for consistent error responses
- Screenshot routes enforce ownership checks — users can only access their own screenshots unless they are admin
- Admin bypass via query parameters has been removed — all access is strictly session-based
- Registration is **disabled** (`/api/register` returns 403); new users are created only by admins via the dashboard

### 8.5 Additional Recommendations

- Set up **HTTPS** via Caddy or a CDN (Cloudflare, etc.)
- Use a **firewall** to restrict access to port 3000 to localhost only
- Change the **default admin password** immediately after deployment
- Set up **automated backups** (see Section 7.2)
- Consider adding **rate limiting** at the reverse proxy level
- Review and rotate session tokens periodically

---

## 9. Maintenance

### 9.1 Updating the Application

```bash
# 1. Pull the latest code
git pull origin main

# 2. Install updated dependencies
bun install

# 3. Regenerate Prisma client and apply schema changes
bunx prisma generate
bunx prisma db push

# 4. Rebuild the application
bun run build

# 5. Restart the service
sudo systemctl restart taskflow
```

### 9.2 Rollback Procedures

```bash
# Check git history
git log --oneline -10

# Rollback to a previous commit
git checkout <commit-hash>

# If schema changed, restore the database from backup first
cp /path/to/backups/taskflow-pre-update.db /opt/taskflow/data/taskflow.db

# Rebuild and restart
bun install
bunx prisma generate
bun run build
sudo systemctl restart taskflow
```

### 9.3 Monitoring and Logging

#### Application Logs

- **Development:** Logs output to terminal and `dev.log`
- **Production:** Logs output to terminal and `server.log`

#### System Monitoring

```bash
# Check service status
sudo systemctl status taskflow

# View live logs
sudo journalctl -u taskflow -f

# Check resource usage
top -p $(pgrep -f "server.js")

# Check database size
du -h /opt/taskflow/data/taskflow.db

# SQLite integrity check
sqlite3 /opt/taskflow/data/taskflow.db "PRAGMA integrity_check;"
```

### 9.4 Troubleshooting Common Issues

| Issue | Cause | Solution |
|---|---|---|
| `PrismaClientInitializationError` | Missing/wrong `DATABASE_URL` or DB file doesn't exist | Verify `.env`, ensure DB directory exists, run `prisma db push` |
| 502 Bad Gateway | App not running or wrong port | Check `systemctl status taskflow`, verify port matches reverse proxy config |
| Session invalid/expired | Session expired (>7 days) or was deleted | User must re-login; adjust `SESSION_DURATION_DAYS` if needed |
| Uploads not accessible | `public/uploads/` missing or wrong permissions | Create directory, set permissions: `chmod 755 public/uploads/` |
| Build fails | TypeScript errors or missing deps | Run `bun install`, check `bun run lint` for errors |
| Drag-and-drop not working | dnd-kit setup issue | Ensure `useDroppable` is used on all drop targets (fixed in final review) |
| SQLite locked | Concurrent write contention | SQLite handles this via WAL mode; ensure `journal_mode=WAL` if issues persist |
| Port already in use | Another process on port 3000 | `lsof -i :3000` to find the process, or change the port |

---

## 10. Architecture Overview

### File Structure

```
src/
├── app/
│   ├── api/                    # API route handlers
│   │   ├── admin/              # Admin-only endpoints
│   │   ├── auth/verify/        # Session verification
│   │   ├── calendar-notes/     # Calendar note CRUD
│   │   ├── client/projects/    # Client-facing project endpoints
│   │   ├── comments/           # Task comments
│   │   ├── dashboard/          # Dashboard stats & activity
│   │   ├── login/              # Authentication (login)
│   │   ├── logout/             # Session termination
│   │   ├── message-groups/     # Group messaging
│   │   ├── messages/           # Direct messages
│   │   ├── onboarding/         # Onboarding forms & submissions
│   │   ├── projects/           # Project CRUD & members
│   │   ├── register/           # Registration (disabled)
│   │   ├── screenshot-config/  # Auto-screenshot settings
│   │   ├── screenshots/        # Screenshot capture & retrieval
│   │   ├── tasks/              # Task CRUD, assignments, subtasks
│   │   ├── time-entries/       # Time tracking & export
│   │   └── users/              # User management
│   ├── globals.css             # Global styles & CSS variables
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Entry page (route guard → dashboard)
├── components/
│   ├── ui/                     # shadcn/ui components (30+ components)
│   ├── messages/               # MessagesPanel
│   ├── onboarding/             # ClientOnboardingWizard
│   └── profile-avatar-upload.tsx
├── features/                   # Feature modules (main application screens)
│   ├── admin-dashboard.tsx     # Admin dashboard (6 tabs)
│   ├── app-shell.tsx           # Layout shell with sidebar, header, nav
│   ├── auto-screenshot.tsx     # Auto-screenshot capture with countdown
│   ├── calendar-note-widget.tsx
│   ├── client-dashboard.tsx    # Client dashboard (4 tabs)
│   ├── login-page.tsx          # Login form
│   ├── route-guard.tsx         # Auth & role-based routing
│   ├── screenshot-capture.tsx  # Manual screenshot capture
│   ├── screenshot-report.tsx   # Screenshot ZIP report generation
│   ├── team-dashboard.tsx      # Team dashboard (4 tabs)
│   └── team-my-tasks.tsx       # Task list/board views
├── hooks/                      # React hooks
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/                        # Core utilities
│   ├── api-auth.ts             # API auth middleware (token extraction, requireAuth, requireAdmin)
│   ├── auth.ts                 # Password hashing (SHA-256) & verification
│   ├── db.ts                   # Prisma client singleton
│   ├── screenshot-capture.ts   # Screenshot capture utility
│   ├── session.ts              # Session management (create, validate, delete)
│   └── utils.ts                # General utilities (cn, etc.)
├── stores/                     # Zustand state stores
│   ├── auth.ts                 # Authentication state
│   └── time-tracking.ts        # Time tracking state
└── types/
    └── index.ts                # TypeScript type definitions

prisma/
├── schema.prisma               # Database schema (16 models)
└── seed.ts                     # Database seeder (admin account)

db/                            # SQLite database files
public/
└── uploads/                    # User-uploaded files
```

### Key Technologies

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 | App Router, standalone output mode |
| Language | TypeScript 5 | Strict mode, `@/*` path alias |
| Styling | Tailwind CSS 4 | CSS-first config, dark mode via `class` |
| UI Components | shadcn/ui | 30+ Radix-based components |
| State Management | Zustand | Auth store, time-tracking store |
| ORM | Prisma 6 | SQLite provider, `db push` workflow |
| Database | SQLite | Single-file, zero-configuration |
| Charts | Recharts | Dashboard analytics |
| Drag & Drop | dnd-kit | Kanban board interactions |
| Animations | Framer Motion | UI transitions |
| Notifications | Sonner | Toast notifications |
| Package Manager | Bun | Fast installs, built-in runner |

---

## 11. Resolved Issues & Fixes

The following issues were identified and resolved during the final production review:

| # | Issue | Fix | Impact |
|---|---|---|---|
| 1 | **Kanban drag-and-drop broken** — Columns were not registered as valid drop targets | Added `useDroppable` hook to all kanban column components so dnd-kit correctly identifies drop zones | Kanban board drag-and-drop now works reliably |
| 2 | **Dead legacy components (~4,698 lines)** — 6 unused component files remaining from earlier iterations | Removed 6 dead component files from the codebase | Reduced bundle size, eliminated confusion for developers |
| 3 | **Duplicate/dead API routes** — 3 API route files were duplicates or no longer used | Removed 3 redundant API route files | Cleaner API surface, no ambiguous route handling |
| 4 | **Missing auth middleware on critical routes** — 7 API routes lacked session authentication | Added session-based auth middleware (`requireAuth`/`requireAdmin`) to all 7 routes | All sensitive endpoints now require valid sessions |
| 5 | **Console.error/log in API routes** — Debug logging statements left in production API handlers | Removed all `console.error()` and `console.log()` statements from API route files | No information leakage in production logs; errors handled via `handleApiError()` |
| 6 | **Unused imports in feature files** — 8 feature files contained imported but unused modules/types | Removed unused imports from all 8 files | Cleaner code, no TypeScript warnings |
| 7 | **`getInitials` crash on empty strings** — Function would throw when passed `""` or `undefined` | Added guard clause to return a default value for empty/undefined input | No more runtime crashes on user profiles without names |
| 8 | **Auto-screenshot countdown off-by-one** — Countdown timer displayed incorrect remaining seconds | Fixed the countdown calculation to display accurate seconds | Users see the correct countdown before screenshot capture |
| 9 | **Unused Skeleton shadow in auto-screenshot** — Visual artifact in the countdown overlay | Removed the unnecessary `shadow` class from the Skeleton component | Cleaner countdown overlay UI |
| 10 | **Dead `authFetch` export** — Exported function no longer used anywhere in the codebase | Removed the unused `authFetch` export from its module | Reduced dead code |
| 11 | **Dead `captureAndUploadScreenshot`** — Standalone function replaced by integrated component logic | Removed the unused `captureAndUploadScreenshot` function | Reduced dead code |
| 12 | **Admin bypass via query param in screenshot routes** — Screenshot API allowed admin access via `?admin=true` query parameter | Removed query parameter bypass; admin access now enforced solely through session role check | Security hardening — no URL-based privilege escalation |

---

## 12. Production Readiness Checklist

Use this checklist to verify the application is ready for production deployment:

### Pre-Deployment

- [ ] **Environment variables configured** — `.env` file created with correct `DATABASE_URL`
- [ ] **Database initialized** — `prisma db push` executed successfully
- [ ] **Admin account seeded** — `bun run prisma/seed.ts` completed, admin can log in
- [ ] **Default admin password changed** — Admin password updated from the default
- [ ] **Build succeeds** — `bun run build` completes without errors
- [ ] **Production server starts** — `bun start` serves the application correctly
- [ ] **All pages load** — Admin, Team, and Client dashboards render without errors
- [ ] **API routes respond** — Key endpoints return correct data (test with `curl` or Postman)

### Security

- [ ] **HTTPS configured** — Caddy or reverse proxy provides SSL/TLS termination
- [ ] **Registration disabled** — `/api/register` returns 403 for all POST requests
- [ ] **All API routes authenticated** — Unauthenticated requests to protected routes return 401
- [ ] **Admin routes restricted** — Non-admin users receive 403 on `/api/admin/*`
- [ ] **Screenshot access controlled** — Users cannot access other users' screenshots
- [ ] **No admin query param bypass** — Screenshot routes don't accept `?admin=true`
- [ ] **No console.log in production** — API routes have no debug logging statements
- [ ] **Port 3000 not publicly exposed** — Firewall restricts access; only reverse proxy reaches it
- [ ] **File upload restrictions** — Upload size/type limits configured at reverse proxy
- [ ] **Session expiry configured** — Sessions expire after the configured duration

### Functionality

- [ ] **Login/logout works** — Users can authenticate and terminate sessions
- [ ] **Role-based routing** — Each role sees only their authorized dashboard
- [ ] **Kanban drag-and-drop** — Tasks can be moved between columns
- [ ] **File uploads** — Avatar and onboarding document uploads work
- [ ] **Time tracking** — Timer start/stop and manual entries function
- [ ] **Auto-screenshot** — Countdown and capture work when enabled
- [ ] **Messaging** — Direct and group messages send and display
- [ ] **Calendar notes** — Notes can be created and edited
- [ ] **Onboarding wizard** — Multi-step forms submit correctly
- [ ] **Data export** — Time entries and screenshot reports export successfully

### Operations

- [ ] **Backup automation configured** — Cron job or script backs up SQLite database daily
- [ ] **Upload directory backed up** — `public/uploads/` included in backup schedule
- [ ] **Process manager configured** — `systemd` service or PM2 manages the application
- [ ] **Auto-restart on failure** — Service restarts automatically if the app crashes
- [ ] **Log rotation configured** — `server.log` and `dev.log` are rotated to prevent disk fill
- [ ] **Monitoring in place** — Health checks or monitoring alerts configured
- [ ] **Rollback procedure documented** — Team knows how to revert to a previous version
- [ ] **Database restore tested** — Restore from backup has been verified
