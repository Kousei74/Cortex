# CORTEX

Enterprise workspace for transforming structured datasets into decision-ready intelligence and governed execution.

CORTEX combines analytics, role-aware operations, and issue orchestration in a single platform. It enables teams to ingest operational data, generate visual insight payloads, coordinate follow-up actions, and manage execution through a controlled governance layer.

## Core Capabilities

- **Data Ingestion**: Secure intake flow for structured source files with guided upload and validation.
- **Command Center**: Background analysis pipeline that produces dashboard-ready outputs for operational review.
- **Service Hub**: Metadata governance surface for managing priority, deadlines, ownership, and departmental routing.
- **Issue Tracker**: Visual execution layer for branch-based issue movement, collaboration, and lifecycle control.
- **Integrated Notifications**: Session-bound Slack visibility for lightweight operational awareness.

## Operating Model

- **Controlled Access**: Invitation-based onboarding with authenticated workspace access.
- **Role-Aware Workflows**: Different operational surfaces for senior and team-member responsibilities.
- **Session-Governed APIs**: Backend activity is protected through centralized session validation.
- **Structured Execution**: Reporting, review, and issue updates follow clear workflow boundaries across the platform.

## Platform Architecture

### Frontend

| Concern | Library |
| :--- | :--- |
| Framework | React + Vite v8.0 |
| State | Zustand |
| Styling | TailwindCSS |
| Motion | Framer Motion |
| Charts | Recharts |
| UI Primitives | Radix UI |

### Backend

- FastAPI
- Supabase
- Custom JWT session layer
- Python analytics services
- Slack integration

## Repository Structure

```text
cortex/
├── frontend/
│   ├── src/components/
│   ├── src/context/
│   ├── src/hooks/
│   ├── src/lib/
│   └── src/store/
└── backend/
    ├── app/api/endpoints/
    ├── app/core/
    ├── app/schemas/
    ├── app/services/
    └── sql/
```

## Local Development

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- Python `3.12+`
- Supabase project credentials

### Frontend

```bash
cd cortex/frontend
npm install
npm run dev
```

### Backend

```bash
cd cortex/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

FastAPI interactive documentation is available at `http://localhost:8000/docs` during local development.

## Configuration

Backend configuration should provide:

- Supabase connection and service credentials
- Session and signing secrets
- Frontend origin and redirect URLs
- Slack OAuth configuration
- Resend delivery configuration

Frontend configuration should provide:

- API base URL
- Upload policy values used by the client

## Deployment Notes

Designed for controlled team environments where operational governance, authenticated access, and internal workflow discipline are required. Production configuration should be managed through environment-based secret injection and standard service separation between frontend, backend, and database layers.

## Access and Governance

- Access is provisioned through a controlled invite flow.
- Session validation governs protected backend operations.
- Governance workflows are role-aware by design.
- Metadata control and issue execution are kept within defined operational boundaries.

## Project Positioning

Structured as an internal operations platform rather than a generic dashboard application, the product surface combines analytics delivery, controlled collaboration, and execution governance into a unified workflow.
