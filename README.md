<h1 align="center">CORTEX</h1>

> **Intelligence Dashboard & Data Ingestion Engine**

CORTEX is a high-performance data ingestion and visualization platform built for structured NLP pipeline outputs (classification, clustering, sentiment). It prioritizes **perceived performance** above all else — the UI never freezes or stalls, even during heavy backend processing.

---

## 🌟 Core Philosophy: "The Illusion of Instant"

- User actions (upload, trigger analysis) happen *instantly* in the UI. The backend synchronizes asynchronously.
- Heavy math runs server-side via FastAPI + background workers. Layouts use `Framer Motion` to prevent shifts.
- Designed to run on zero-cost infrastructure (free-tier FastAPI + Supabase).

---

## 🏗 System Architecture

### 1. **Frontend: "The Illusionist"** (React + Vite)
- **State**: `Zustand` — `analysisStore` (job/status/payload) + `workspaceStore` (view mode, cluster selection)
- **Visuals**: `Framer Motion` for transitions, `Recharts` for all charts
- **Loader**: Full-screen pulsing orb (`CortexLoader`) during processing — cyan for active, red on error
- **Resilience**: Network status monitoring via `useNetworkStatus`

### 2. **Backend: "The Shadow"** (FastAPI + Python)
- **Ingestion**: Files uploaded to `/ingest`, job enqueued immediately via PGMQ
- **Processing**: `analysis.py` runs classification aggregation, sentiment, clustering, temporal detection
- **Smart Layout**: Auto-detects whether to render **Temporal** (time-series) or **Snapshot** (pivot/stacked bar) based on data shape
- **Validation**: IQR clamping, fragmentation fail-safes, degenerate visualization handling

---

## 🛠 Tech Stack

### **Frontend**
| Concern | Library |
| :--- | :--- |
| Framework | React 19, Vite |
| Styling | TailwindCSS v4 |
| Animation | Framer Motion |
| Visualization | Recharts |
| State | Zustand |
| Icons | Lucide React |
| UI Primitives | Radix UI |

### **Backend**
| Concern | Library |
| :--- | :--- |
| Framework | FastAPI (Python 3.12+) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth) |
| Queue | PGMQ |
| Processing | Pandas, scikit-learn |

---

## 📂 Project Structure

```text
cortex/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── visualizers/
│       │   │   ├── bar_chart.jsx       # Stacked bar (snapshot pivot)
│       │   │   ├── temporal-widget.jsx # Time-series line chart
│       │   │   ├── donut-widget.jsx    # Donut with "Others" bucketing
│       │   │   ├── treemap-widget.jsx  # Game/title treemap
│       │   │   ├── scatter-widget.jsx  # Confidence scatter
│       │   │   ├── kpi-card-widget.jsx # Single KPI card
│       │   │   └── anchor-container.jsx# Shared chart wrapper (inset glow)
│       │   ├── cortex-loader.jsx       # Pulsing orb loader
│       │   ├── main-content.jsx        # Command Center layout + transitions
│       │   ├── kpi-cards.jsx           # KPI card row
│       │   ├── report-view.jsx         # Layout strategy router
│       │   ├── sub-anchor-row.jsx      # Secondary chart row
│       │   ├── staging-area.jsx        # File upload / data ingestion
│       │   └── sidebar.jsx             # Navigation
│       ├── store/
│       │   ├── analysisStore.js        # Job ID, status, payload
│       │   └── workspace-store.js      # View mode, cluster selection
│       └── hooks/
│           ├── use-network-status.js
│           └── use-resolution.js
│
└── backend/
    └── app/
        ├── api/endpoints/              # ingest, reports, resolution
        ├── services/analysis.py        # Core analysis engine
        ├── schemas/report.py           # ReportPayload contract
        └── core/config.py
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- Supabase account (for auth + DB)

### 1. Clone & Install
```bash
git clone https://github.com/Kousei74/Cortex.git
cd Cortex
```

### 2. Frontend Setup
```bash
cd cortex/frontend
npm install
npm run dev
# http://localhost:5173
```

### 3. Backend Setup
```bash
cd cortex/backend
python -m venv venv
# Windows: venv\Scripts\activate  |  Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

### 4. Environment Variables
Create `cortex/backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_service_role_key
```

---

## 🔌 API Overview

### Ingestion
- `POST /ingest` — Upload CSV files, triggers async analysis job, returns `job_id`

### Reports
- `GET /reports/poll/{job_id}` — Poll job status (`PENDING` → `PROCESSING` → `COMPLETED` / `FAILED`). Returns full `ReportPayload` on completion.

### Resolution
- `POST /resolution/resolve` — Apply bulk actions (merge, dismiss) to clusters

---

## 📊 Dashboard Visualizations

| Component | File | Description |
| :--- | :--- | :--- |
| Stacked Bar | `bar_chart.jsx` | 100% stacked bars per cluster/category with tube-effect rounding |
| Time Series | `temporal-widget.jsx` | Confidence/sentiment over time |
| Donut | `donut-widget.jsx` | Cluster distribution — slices ≤1% grouped into "Others" with breakdown tooltip |
| Treemap | `treemap-widget.jsx` | Game/title hierarchy by volume |
| KPI Cards | `kpi-cards.jsx` | Total reviews, top cluster, sentiment, avg polarity |

---

## ✅ Feature Status

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Drag & Drop Ingestion | ✅ Done | Magic Byte validation, multi-file |
| Async Analysis Pipeline | ✅ Done | PGMQ-backed, status polling |
| Smart Layout Detection | ✅ Done | Auto Temporal vs Snapshot pivot |
| Orb Loader | ✅ Done | Full-screen pulsing orb, error state in red |
| Command Center Dashboard | ✅ Done | KPI cards, charts, smooth fade-in transition |
| Donut "Others" Bucketing | ✅ Done | Slices ≤1% collapsed with hover breakdown |
| Cluster Resolution UI | 🚧 In Progress | Merge, dismiss, conflict tracking |
| Offline / Degraded Mode | 🚧 In Progress | Read-only IndexedDB fallback |
| Role-Based Governance | ⏳ Planned | Senior approvals, immutable decisions |
| Canvas Fallback (>10k pts) | ⏳ Planned | VisX for large dataset rendering |

---

> **Built for speed. Designed for flow.**
