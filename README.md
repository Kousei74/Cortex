<h1 align="center">CORTEX</h1>

> **The Dashboard & Ingestion Engine**

Cortex is a high-performance, locally optimistic data ingestion and visualization platform designed for the GameSpot/Metacritic ecosystem. It prioritizes **perceived performance** above all else, using a "Shadow Backend" architecture to ensure the UI never freezes, stutters, or stalls—even during heavy data processing.

## 🌟 Core Philosophy: "The Illusion of Instant"

- User actions (upload, tag, pivot) happen *instantly* in the UI. The server synchronizes in the background.
- Heavy math runs in Web Workers. Layouts use `Framer Motion` layout projection to prevent layout shifts.
- Designed to run on free-tier capable serverless/edge infrastructure (Vercel + Supabase).

---

## 🏗 System Architecture

### 1. **Frontend: "The Illusionist"** (React + Vite)
- **State**: `Zustand` with persistent storage (survives refreshes)
- **Visuals**: `Framer Motion` for layout transitions, `Recharts` for sub-10k point visualization
- **Resilience**: "Dead Man's Switch" shifts to Read-Only `IndexedDB` mode if the internet cuts out

### 2. **Backend: "The Shadow"** (FastAPI + Python)
- **Ingestion**: "Headless" upload. Metadata is sent first (`POST /ingest/meta`) to generate an ID instantly. Binary data streams in parallel (`PUT /ingest/blob`)
- **Processing**: `PGMQ` (Postgres Message Queue) handles async jobs (OCR, Sentiment Analysis, Clustering)
- **Smart Analysis**: Automatically detects "Satellites" (Time, Cluster context) to decide whether to render a **Temporal** (Time-Series) or **Snapshot** (Pivot) dashboard

---

## 🛠 Tech Stack

### **Frontend**
- **Framework**: React 19, Vite
- **Styling**: TailwindCSS v4
- **Animation**: Framer Motion
- **Visualization**: Recharts, Lucide React
- **State Management**: Zustand, React Query (implied)
- **UI Components**: Radix UI Primitives

### **Backend**
- **Framework**: FastAPI (Python 3.12+)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google OAuth)
- **Queue**: PGMQ
- **Processing**: Pandas, Tesseract (OCR)

---

## 📂 Project Structure

```text
CORTEX/
├── frontend/                 # React Application
│   ├── src/
│   │   ├── components/       # Visualizers, KPI Cards, Zeno Progress
│   │   ├── hooks/            # useReportPolling, useNetworkStatus
│   │   ├── store/            # Zustand Stores (analysisStore)
│   │   └── lib/              # Utils (Magic Bytes, Formatters)
│
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # Endpoints (Reports, Ingest)
│   │   ├── core/             # Config, State Machine, Queue
│   │   ├── services/         # Analysis, Detect Satellites
│   │   └── models/           # Pydantic Schemas (ReportPayload)
│   └── uploads/              # Temp storage for processing
│
├── contracts/                # Shared API Schemas (YAML/JSON)
└── docs/                     # Architectural Documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker (optional, for DB/Queue)
- Supabase Account

### 1. Clone & Install
```bash
git clone https://github.com/Kousei74/Cortex.git
cd Cortex
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
# Docs on http://localhost:8000/docs
```

---

## 🔌 API Overview

### Ingestion
- `POST /ingest/meta`: Initialize upload (returns `job_id`).
- `PUT /ingest/blob/{id}`: Stream binary file content.

### Reports (Async)
- `POST /reports/request`: Trigger analysis for a batch of files.
- `GET /reports/poll/{id}`: Check status (`pending`, `processing`, `completed`). Returns the `ReportPayload` when done.

### Resolution
- `POST /resolution/resolve`: Apply bulk actions (Merge, Dismiss) to clusters.

---

## ✅ Feature Status

| Feature | Status | Description |
| :--- | :---: | :--- |
| **Drag & Drop Zone** | ✅ Done | Magnetic expansion, Magic Byte validation. |
| **Zeno Progress** | ✅ Done | Asymptotic loading bars that never stall. |
| **Headless Ingestion** | ✅ Done | Metadata/Binary separation. |
| **Smart Dashboard** | ✅ Done | Auto-pivots based on Time/Cluster availability. |
| **Satellite Detection** | ✅ Done | Backend logic for schema-on-read. |
| **Cluster Resolution** | 🚧 In Progress | UI for merging, splitting, and dismissing entities. |
| **Offline Mode** | 🚧 In Progress | Read-only degraded state with cached views on network failure. |
| **Canvas Fallback** | ⏳ Todo | Automatic switch to VisX for datasets exceeding 10k points. |
| **Issue Tracker (V1)** | 🚧 In Progress | Structured issue creation, assignment, and lifecycle control with role-based permissions. |
| **Visual Issue Resolution Tree** | 🚧 In Progress | Directed flowchart of issue progression with Yellow/Blue/Green/Red decision states. |
| **Branch & Merge Workflow** | 🚧 In Progress | Temporary blue-branch execution paths that collapse into a single accepted resolution node. |
| **Role-Based Governance** | 🚧 In Progress | Senior-only approvals, merges, and closures with immutable decision enforcement. |
| **Ticket Chaining** | ⏳ Todo | Parent and linked ticket relationships for reopening or extending resolved issues. |

---

## 🤝 Contributing

1.  **Fork** the repository.
2.  Create a **Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4.  **Push** to the branch (`git push origin feature/AmazingFeature`)
5.  Open a **Pull Request**.

---

> **Built for speed. Designed for flow.**
