<h1 align="center">CORTEX</h1>

> Closed-door analytics workspace for upload, visualization, collaboration, and issue governance.

CORTEX is a FastAPI + React application for taking structured datasets, generating a dashboard payload, and coordinating follow-up work through a visual issue tracking system. The current deployment target is a controlled internal rollout, not a horizontally scaled public SaaS.

---

## What It Does

- **Data ingestion**: stage files in the frontend, register upload metadata, then stream the binary payload to the backend.
- **Command center**: generate a report payload and render it in the dashboard once analysis completes.
- **Service Hub**: create and update root issues, assign departments, and govern execution flow.
- **Execution Ledger**: inspect active or closed issues and traverse the linked DAG for downstream work.
- **Slack panel**: view-only notifications feed, bound to the main Cortex session.

---

## Current Deployment Profile

This project is intentionally optimized for a **single backend instance**.

- The report queue is in memory.
- Upload sessions are in memory.
- The background worker is started inside the FastAPI process.
- The auth throttler is in memory.

That means:

- **Do deploy**: one FastAPI instance, one frontend, one background worker started by the app.
- **Do not deploy yet**: multiple API replicas, multiple Uvicorn workers, load-balanced report processing, or distributed queueing.

For the current department-scale rollout, that tradeoff is deliberate.

---

## Auth Model

CORTEX now uses a **closed-door auth flow**:

1. Public users can only **request access**.
2. An admin approves the request manually.
3. The admin sends a **one-time invite link**.
4. The invite opens the existing signup route directly.
5. The user completes signup and is redirected back to login.
6. Normal login issues the Cortex JWT used across protected backend routes.

Protected routes use the shared JWT/session dependency, so when the session expires the UI shell can still render, but backend-backed reads and writes are blocked until the user logs in again.

---

## Guardrails Added

### Upload limits

- Frontend file-size cap: **10 MB per file** by default
- Backend hard limit: **10 MB per file** by default
- Oversized uploads are rejected with `413`
- Backend upload enforcement is done on:
  - metadata registration
  - `Content-Length`
  - streamed byte counting during upload

### Report queue controls

- **Max active report jobs per user**: `1`
- **Max global pending jobs**: `15`
- Idempotent re-submission of the same file set returns the existing job instead of creating a duplicate

### Polling behavior

- Report polling backoff: `1s -> 2s -> 3s -> 5s -> 10s -> 30s -> stop`
- Review Explorer polling: `15s`
- Slack polling: `30s`
- Locked tabs stop all report/review/slack polling

### Single-tab session control

- Only one active tab should control Cortex at a time
- Locked tabs show the overlay and stop background polling
- The user can explicitly reclaim the active tab with **Resume Here**

---

## Tech Stack

### Frontend

| Concern | Library |
| :--- | :--- |
| Framework | React + Vite |
| State | Zustand |
| Styling | TailwindCSS |
| Motion | Framer Motion |
| Charts | Recharts |
| UI Primitives | Radix UI |

### Backend

| Concern | Library |
| :--- | :--- |
| Framework | FastAPI |
| Auth | Custom JWT session layer |
| Database | Supabase |
| Processing | Pandas / scikit-learn pipeline in `analysis.py` |
| Slack | Slack OAuth + server-side token storage |

---

## Project Layout

```text
cortex/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── auth-flow.jsx
│       │   ├── background-poller.jsx
│       │   ├── service-hub.jsx
│       │   ├── issue-tracker.jsx
│       │   ├── single-instance-lock.jsx
│       │   └── staging/
│       ├── context/
│       ├── hooks/
│       ├── lib/
│       └── store/
└── backend/
    └── app/
        ├── api/endpoints/
        ├── core/
        ├── schemas/
        ├── services/
        └── worker.py
```

---

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- Supabase project

### Frontend

```bash
cd cortex/frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### Backend

```bash
cd cortex/backend
python -m venv venv
# Windows
venv\Scripts\activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend docs are available at `http://localhost:8000/docs`.

---

## Environment Variables

Create `cortex/backend/.env` with the following values:

```env
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...

SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_REDIRECT_URI=http://localhost:8000/service/slack/callback

FRONTEND_URL=http://localhost:5173

MAX_UPLOAD_SIZE_MB=10
MAX_ACTIVE_JOBS_PER_USER=1
MAX_PENDING_JOBS=15
```

Optional frontend envs in `cortex/frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_MAX_UPLOAD_SIZE_MB=10
```

---

## Admin Invite Flow

Pending access requests are approved manually.

Current v1 workflow:

1. User submits **Request Access**
2. Admin reviews pending request
3. Admin generates invite
4. Admin sends invite URL manually
5. User signs up through the invite page

If you are using the helper approval script, run it from:

```bash
cd cortex/backend
python admin_approve.py
```

---

## API Overview

### Public auth routes

- `POST /auth/request-access`
- `GET /auth/invite/verify`
- `POST /auth/invite/complete`
- `POST /auth/login`

### Protected routes

- `GET /auth/me`
- `PUT /auth/profile`
- `POST /ingest/meta`
- `PUT /ingest/blob/{file_id}`
- `POST /reports/jobs`
- `GET /reports/jobs/{job_id}`
- `/service/*`
- `/resolution/*`

### Upload + report flow

1. `POST /ingest/meta`
2. `PUT /ingest/blob/{file_id}`
3. `POST /reports/jobs`
4. `GET /reports/jobs/{job_id}` until complete

---

## Service Hub + Execution Ledger

### Service Hub

- Senior-oriented governance surface
- Creates root issues
- Updates metadata like priority, deadline, and assigned departments
- Uses server-side department ownership rules from the authenticated user

### Execution Ledger

- Lists active and closed issues
- Shows a visual DAG for downstream branches
- Enforces access rules from the current session JWT

### Tag states

| Tag | Meaning |
| :--- | :--- |
| `pending` | initial node state |
| `yellow` | caution / intermediary state |
| `blue` | validated branch pending merge |
| `green` | accepted / merged path |
| `red` | terminal branch |

Undo/restore has been intentionally removed.

---

## Known Constraints

- Single-instance backend only
- Report polling stops after the final backoff window; if a job is still running after that, revisit the dashboard to poll again
- Locked tabs stop polling, but already in-flight network requests are not forcibly aborted
- Invite approval is still a manual process in v1

---

## Status

| Area | Status |
| :--- | :--- |
| Closed-door auth flow | ✅ |
| JWT-gated backend routes | ✅ |
| View-only Slack integration | ✅ |
| Upload size enforcement | ✅ |
| Report job caps | ✅ |
| Tab lock polling shutdown | ✅ |
| Multi-instance scaling | Not yet |
