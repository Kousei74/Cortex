# Backend Implementation Workflow (Roadmap)

This document outlines the step-by-step execution plan to build the "Issue Tracker & Visual Resolution System (V1)" backend. It follows the **"Backend as Architect"** philosophy, ensuring the API Contract (`report_payload.v1.yaml`) is strictly enforced.

---

## 🛑 Phase A: The Core Engine (`AnalysisService`)
**Goal**: Build the "Brain" that ingests raw files and manufactures the strict `ReportPayload`.

### Step 1: Ingestion & Safety Nets
*   **File Loading**: Implement `load_dataset()` in `app/services/ingestion.py`.
    *   **Logic**: Load CSV/JSON/Parquet into Pandas.
    *   **Guardrail 1**: Check file size < 100MB *before* parsing.
    *   **Guardrail 2**: Use `category` types for low-cardinality string columns (Memory Optimization).
    *   **Sanitization**: Replace `NaN`, `Info`, `-Inf` with `None` (JSON safe).

### Step 2: Satellite Detection (The Ternary Decision Tree)
*   **Logic**: Implement `detect_satellites(df) -> LayoutStrategy` in `app/services/analysis.py`.
*   **Gate 1: Can TEMPORAL_SUPREME be built?**
    *   *Check*: `Timestamp` column exists? AND Valid Datetime Parse? AND Sufficient Rows (>1)?
    *   *Result*: If Pass -> `TEMPORAL_SUPREME` (Option A).
*   **Gate 2: Can SNAPSHOT_PIVOT be built?**
    *   *Check*: At least one Categorical Dimension? AND At least one Aggregatable Metric?
    *   *Result*: If Pass -> `SNAPSHOT_PIVOT` (Option B).
*   **Gate 3: Fallback**
    *   *Result*: `UNSUPPORTED_DATASET` (Hard Fail).

### Step 3: Widget Manufacturing (The Aggregators)
*   **Rule**: **Validation is part of construction.** Builders raise exceptions; invalid widgets are never created.
*   **Logic**: Implement private builder methods:
    *   `_build_temporal_payload(df)`: Resamples by Day/Week.
    *   `_build_snapshot_payload(df)`:
        *   Aggregates by Title -> `ComboChartWidget`.
        *   Aggregates by Cluster -> `BarChartWidget`.
        *   **Correlation Logic**: Only build `ScatterWidget` if Confidence/Sentiment columns exist AND pass **Numeric Type + Variance Checks** (No flat lines).

### Step 4: Payload Assembly
*   **Logic**: `generate_report_payload(file_ids) -> ReportPayload`
    *   Orchestrates Steps 1-3.
    *   **Constraint**: If data is unusable (Step 2 Gate 3), returns `UNSUPPORTED_DATASET` payload with `reason_code` and `missing_requirements`.

---

## ⚡ Phase B: The API Layer (Endpoints)
**Goal**: exposing the engine safely to the Frontend.

### Step 5: Job Handler (`POST /reports/jobs`)
*   **Endpoint**: `app/api/endpoints/reports.py`.
*   **Input**: `ReportRequest` (List of file IDs).
*   **Idempotency Check**:
    *   Generate `job_hash = hash(sorted(file_ids))`.
    *   Check Redis/DB: Is this hash already `processing`?
    *   **Yes** → Return existing `job_id`.
    *   **No** → Create new Job, Push to PGMQ, Return new `job_id`.

### Step 6: Polling Handler (`GET /reports/jobs/{job_id}`)
*   **Logic**:
    *   Check DB for Job Status.
    *   **If Completed**: Fetch `ReportPayload` (JSON) from Storage/DB and return it.
    *   **If Failed**: Return Error Code.
    *   **If Processing**: Return `progress` % (simulated or real).

---

## ⚙️ Phase C: Asynchronous Infrastructure (PGMQ)
**Goal**: The "Invisible" worker that prevents main-thread blocking.

### Step 7: Worker Integration
*   **Queue Consumer**: Implement a lightweight worker loop.
    *   Polls `report_queue`.
    *   Calls `AnalysisService.generate_report_payload()`.
    *   Updates Job Status in DB.
    *   **Timeout Safety (Reaper)**: If job takes > 60s:
        *   Mark Job as `FAILED`.
        *   Reason: `TIMEOUT_EXCEEDED`.
        *   **Action**: Release Idempotency Lock (Allow retry).
        *   **No Automatic Retry** (Fail fast).

---

## 📝 Execution Checklist (Order of Operations)

1.  **[ ] Phase A (Engine)**: Implement `ingestion.py` and `analysis.py`.
2.  **[ ] Phase B (API)**: Implement Router (`/reports/jobs`) and Idempotency logic.
3.  **[ ] Phase C (Worker)**: Wire up the PGMQ consumer and Reaper logic.

**Verification**:
Run Unit Test feeding:
1.  Valid Time Series -> Expect `TEMPORAL`.
2.  Valid Categorical -> Expect `SNAPSHOT`.
3.  Garbage CSV -> Expect `UNSUPPORTED`.
4.  Flat-line Data -> Expect `ScatterWidget` omitted from Snapshot options.
