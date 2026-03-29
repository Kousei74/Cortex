<h1 align="center">CORTEX</h1>

> **Intelligence Dashboard & Data Ingestion Engine**

CORTEX is a high-performance visualization and issue tracking platform built for structured NLP pipeline outputs (classification, clustering, sentiment).

---

## 🏗 System Architecture

### 1. **Frontend:** (React + Vite)
- **State**: `Zustand` — `analysisStore` (job/status/payload) + `workspaceStore` (view mode, cluster selection)
- **Visuals**: `Framer Motion` for transitions, `Recharts` for all charts
- **Loader**: Full-screen pulsing orb (`CortexLoader`) during processing — cyan for active, red on error
- **Resilience**: Network status monitoring via `useNetworkStatus`

### 2. **Backend:** (FastAPI + Python)
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
│       │   │   ├── bar_chart.jsx       # Stacked bar
│       │   │   ├── temporal-widget.jsx # Time-series line chart
│       │   │   ├── donut-widget.jsx    # Donut with "Others" bucketing
│       │   │   ├── treemap-widget.jsx  # Title treemap
│       │   │   ├── scatter-widget.jsx  # Confidence scatter
│       │   │   ├── kpi-card-widget.jsx # Single KPI card
│       │   │   └── anchor-container.jsx# Shared chart wrapper (inset glow)
│       │   ├── cortex-loader.jsx       # Pulsing orb loader
│       │   ├── main-content.jsx        # Command Center layout + transitions
│       │   ├── kpi-cards.jsx           # KPI card row
│       │   ├── report-view.jsx         # Layout strategy router
│       │   ├── sub-anchor-row.jsx      # Secondary chart row
│       │   ├── staging-area.jsx        # File upload / data ingestion
│       │   ├── sidebar.jsx             # Navigation
│       │   ├── service-hub.jsx         # Issue creation (Seniors)
│       │   ├── issue-tracker.jsx       # Execution ledger list/dag view
│       │   ├── issue-flowchart.jsx     # Visual React Flow DAG resolution tree
│       │   └── ui/                     # Shared UI primitives (team-multi-select, etc)
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

## 🧠 Issue Tracker & Resolution Engine

CORTEX features a sophisticated issue management system designed for high-stakes data operations, combining structured governance with a visual resolution tree.

### 1. **Service Hub (Governance)**
Reserved for **Senior** roles, the Service Hub is the entry point for all project activities.
- **Root Truth Definition**: Create high-level "ISS-" tickets to initialize resolution graphs.
- **Metadata Management**: Update priorities, deadlines, and multi-team assignments.
- **RBAC Enforcement**: Support Agents are restricted from this interface, ensuring centralized control over the project's root state.

### 2. **Execution Ledger (Management)**
The centralized command center for tracking ongoing and resolved activities across all departments.
- **Status Filtering**: Toggle between `Active` and `Closed` issue pipelines.
- **Visual Priority**: Real-time color-coding (Red, Orange, Yellow, Green) based on ticket urgency.
- **Contextual Actions**: Right-click context menus for quick ID copying and navigation.

### 3. **Resolution DAG (Visual Flow)**
Powered by `React Flow`, this interactive Directed Acyclic Graph (DAG) manages the complex life-cycle of an issue resolution.
- **Branching Logic**: Create sub-nodes from any point to explore parallel resolution tracks.
- **Merge Validation**: "Blue" branches require mandatory documentation (code snippets + description) before merging back into the main trunk.
- **30-Minute Security Lock**: 30-minute window for edits/deletions on new nodes to prevent historical data manipulation.
- **Terminal State**: "Red" nodes represent terminal failure or termination, locking the entire graph from further modifications.

### 🏷 Status Tag Logic

| Tag | Color | Meaning |
| :--- | :--- | :--- |
| `pending` | ⚪ Gray | Initial state, awaiting agent action. |
| `yellow` | 🟡 Yellow | Intermediate/Warning state, requires additional investigation. |
| `blue` | 🔵 Blue | Validated branch; requires documentation/senior review for merge. |
| `green` | 🟢 Green | Successful resolution path completed. |
| `red` | 🔴 Red | Terminal failure/Termination state (Closes the entire issue). |

---

## ✅ Feature Status

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Drag & Drop Ingestion | ✅ Done | Byte validation, multi-file |
| Async Analysis Pipeline | ✅ Done | PGMQ-backed, status polling |
| Smart Layout Detection | ✅ Done | Auto Temporal vs Snapshot pivot |
| Orb Loader | ✅ Done | Full-screen pulsing orb, error state in red |
| Command Center Dashboard | ✅ Done | KPI cards, charts, smooth fade-in transition |
| Donut "Others" Bucketing | ✅ Done | Slices collapsed with hover breakdown |
| Service Hub | ✅ Done | File new issues or link child issues |
| Slack Integration | ✅ Done | Live channel notifications in sidebar |
| Execution Ledger & Issue DAG | ✅ Done | Visual resolution tree, 🟢🔵🔴🟡 tag logic with React Flow |
| Role-Based Governance | ✅ Done | Senior approvals via Service Hub, RLS array enforcement |
| Phase 1 Resolution Logic | ✅ Done | Terminal enforcement, OCC, Yellow stacking, Context Menu ID copy |
| Connection-Aware Tree Arch | ✅ Done | Backtracking-first logic for branching & gating |
| Dashboard Aesthetics | ✅ Done | Fluid design system, premium hover effects, neon-dystopian theme |
| Offline / Degraded Mode | 🚧 In Progress | Read-only IndexedDB fallback |
| Canvas Fallback (>10k pts) | ⏳ Planned | VisX for large dataset rendering |

---
