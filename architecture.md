# CORTEX System Architecture

> **Version**: 1.0
> **Status**: FROZEN (DO NOT EDIT WITHOUT EXPLICIT USER OVERRIDE)
> **Philosophy**: "Seamlessness Over Everything Else"
> **Core Pattern**: Locally Optimistic UI ("The Illusionist") backed by an Event-Driven Python Engine ("The Shadow").

---

## 1. High-Level Architecture

The system is divided into two distinct sovereign domains that communicate *asynchronously*.

```mermaid
graph TD
    subgraph Client ["The Illusionist (Frontend)"]
        UI[React App]
        Store[Zustand Store (Persisted)]
        Worker[Web Worker (Calculations)]
        
        UI -->|Action| Store
        Store -->|Optimistic Update| UI
        Store -->|Sync| Background[Sync Service]
    end

    subgraph Cloud ["The Infrastructure"]
        Edge[Vercel Edge / CDN]
        Auth[Supabase Auth / Google OAuth]
        DB[(Supabase PostgreSQL)]
        Storage[(Supabase Storage)]
        Queue[PGMQ (Postgres Message Queue)]
    end

    subgraph Engine ["The Shadow (Backend)"]
        API[FastAPI Gateway]
        Ingest[Ingestion Service]
        Processor[Data Processor (Pandas/Tesseract)]
        
        API -->|Enqueue| Queue
        Queue -->|Pull Job| Processor
        Processor -->|Update| DB
    end

    Background -->|REST / Stream| API
    Background -->|Direct Read| DB
    Background -->|Upload| Storage
    Processor -->|Read| Storage
```

---

## 2. Directory Structure (Monorepo)

The repository uses a clear separation of concerns under a single master root.

```text
CORTEX/
├── frontend/                 # "The Illusionist"
│   ├── src/
│   │   ├── stores/           # Zustand (Optimistic Logic)
│   │   ├── components/       # UI Components (Framer Motion)
│   │   ├── hooks/            # Logic & Data Fetching
│   │   ├── workers/          # Web Workers (Parsing/Math)
│   │   └── services/         # API Clients
│   ├── public/
│   └── package.json
│
├── backend/                  # "The Shadow Engine"
│   ├── app/
│   │   ├── api/              # FastAPI Routes (v1)
│   │   ├── core/             # Config, Security (OAuth)
│   │   ├── services/         # Business Logic (Ingest, OCR)
│   │   ├── models/           # Pydantic Schemas
│   │   └── worker.py         # PGMQ Consumer
│   ├── Dockerfile
│   └── requirements.txt
│
├── docs/                     # Architecture & PRD
│   ├── architecture.md
│   └── project-context.md
│
└── docker-compose.yml        # Local Dev Orchestration
```

---

## 3. Component Details

### 3.1 Frontend: "The Illusionist" (React + Vite)
**Goal**: Maintain 60 FPS and 0ms perceived latency.

*   **State Management**: `Zustand` with `persist` middleware.
    *   **Queue Pattern**: User actions (e.g., "Upload File", "Update Metadata") are added to a local queue immediately. The UI reflects the change. The `SyncService` processes this queue in the background.
*   **Routing**: `React Router` with `View Transitions API` for seamless page morphing.
*   **Visuals**:
    *   **Framer Motion**: For "Layout Groups" (filling gaps when items are removed) and micro-interactions.
    *   **Recharts/VisX**: Dual-mode rendering. Uses SVG (Recharts) for <10k points, switches to Canvas (VisX) for massive datasets.
*   **Resilience**:
    *   **Dead Man's Switch**: If API is unreachable, switch to `Read-Only Mode` utilizing `IndexedDB` or cached Zustand state.
    *   **Web Workers**: Heavy JSON parsing and data transformation happen off the main thread.

### 3.2 Backend: "The Shadow Engine" (FastAPI + Python)
**Goal**: Robustness and flexibility ("Schema-on-Read").

*   **Runtime**: Containerized Python Environment (Docker).
*   **API Layer (FastAPI)**:
    *   `POST /ingest/meta`: Accepts file metadata. Returns a `job_id` in <10ms.
    *   `PUT /ingest/blob/{id}`: Streams binary data to Storage.
*   **Asynchronous Worker (PGMQ)**:
    *   Decouples ingestion from processing.
    *   **Zombie Killer**: Middleware checks for jobs stuck in `processing` > 30s (e.g., worker crash) and resets visibility.
*   **Data Processing**:
    *   **Universal Adapter**: Logic to detect extension (csv, xlsx, json).
    *   **Normalization**: Flattens inputs to a standard internal structure for visualization.
        *   Required: `id`, `title`, `sentiment` (float), `cluster` (string/int).
        *   Optional: Stored in a `metadata` JSONB column.
    *   **OCR**: Tesseract integration for image-heavy PDFs.

### 3.3 Data Storage (Supabase)
*   **Auth**: Google OAuth + Supabase Auth. Simple row-level security (RLS) linked to User ID.
*   **Database**: PostgreSQL.
    *   `jobs`: Tracks processing status (pending, processing, completed, failed).
    *   `artifacts`: flexible JSONB storage for parsed data (Schema-on-Read).
*   **Storage**: Buckets for raw uploads (`incoming`) and processed assets (`processed`).

---

## 4. Key Data Flows

### 4.1 "Hole-Less" Ingestion
1.  **User Drop**: User drops 3 files (JSON, CSV, XLSX).
2.  **Instant UI**:
    *   "Ghost Cards" appear immediately (local temp IDs).
    *   Files begin "uploading" visually (asymptotic progress bar).
3.  **Backend Handshake**:
    *   Frontend request: `POST /ingest/init` (metadata).
    *   Backend: Creates DB entries, returns signed Upload URLs.
4.  **Parallel Stream**:
    *   Frontend streams binary directly to Storage via signed URLs (bypassing API bottleneck if possible, or streaming through API).
5.  **Queue trigger**:
    *   Once upload finishes, Frontend notifies `POST /ingest/commit`.
    *   Backend pushes `process_job` to PGMQ.
6.  **Processing**:
    *   Worker picks up job.
    *   Detects type -> Normalizes to `DataFrame`.
    *   Extracts `sentiment`, `cluster`, `title`.
    *   Saves result to `artifacts` table.
    *   Updates `job` status to `completed`.
7.  **Completion**:
    *   Frontend polls (or uses Supabase Realtime) to see `completed` status.
    *   Ghost Card transforms into Result Card.

### 4.2 "Black Swan" Handling
*   **Network Cut**: `window.addEventListener('offline')`. UI shows "Offline Mode". Queue pauses. On `'online'`, queue flushes.
*   **Malformed File**: Worker fails job. `jobs.status` = `error`. UI shows "Analysis Failed" on the card but **does not crash**.
*   **Long Processing**: If > 300ms, UI shows "Analyzing..." state. If > 10s, UI offers "Notify me when done" or simply implies background work.

## 5. Security & Auth
*   **Provider**: Google OAuth (via Supabase).
*   **Scope**:
    *   Users can only see/edit their own jobs (RLS policy: `user_id = auth.uid()`).
    *   Public access is strictly disabled.

## 6. Deployment Strategy
*   **Frontend**: Vercel (Static / Edge).
*   **Backend**: Railway / Fly.io (Docker container for Python/Tesseract requirements).
*   **Database**: Supabase (Managed Postgres).
