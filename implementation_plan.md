# Implementation Plan: Cortex Analysis Engine V2 (The Constitution Rewrite)

## Goal
Completely rewrite `cortex/backend/app/services/analysis.py` to strictly enforce the **Visualization Constitution**. Replace all existing heuristic logic with deterministic, law-based execution.

## User Review Required
> [!IMPORTANT]
> **Fresh Code Policy**: `analysis.py` will be wiped and rewritten.
> **Breaking Schema Changes**: `PieChartWidget` is removed. `MultiLineWidget` constraints are tightened.
> **Strictness**: Data processing will be aggressive about disqualifying unstructured data (e.g., "Unclassified" anchors banned).

---

## Phase 1: Foundation & Schemas

### 1.1 [MODIFY] `app/schemas/report.py`
*   **Remove Banned Types**: Delete `PieChartWidget`, `DonutChartWidget` (if present).
*   **Add Strict Types**:
    *   `HistogramWidget`: For "Last Resort" logic.
    *   `KPICardWidget`: For "Degenerate" logic (1 data point).
*   **Update Enums**: `WidgetType` enum must reflect only legal charts (Line, Area, Bar, StackedBar, Combo, Scatter, Histogram, KPI).

### 1.2 [MODIFY] `app/core/config.py` (Optional)
*   Define global constants for limits: `MAX_CLUSTERS=50`, `MIN_ROWS_TIME=30`, `METRIC_DENSITY_THRESHOLD=0.05`.

---

## Phase 2: The "Constitution" Engine (`analysis.py` Rewrite)

### 2.1 [NEW] Data Normalization & Hygiene
*   `normalize_frame(df) -> df`:
    *   Coerce strict types (Timestamp -> datetime, Sentiment -> float).
    *   **Unclassified Law**: Coerce NULL Strings -> `(Unclassified)`.
    *   **Metric Validity**: Calculate density. If `< 5%`, drop column from "Active Metrics".

### 2.2 [NEW] Satellite Detection (The "Roles")
*   `detect_roles(df) -> dict`:
    *   Identify **The Sun** (Classification): Check Cardinality (2-12).
    *   Identify **The Context** (Cluster): Check Cardinality (2-50). Check Mono-Cluster (<2) ban. Check Fragmentation (>50% Others).
    *   Identify **The Dictator** (Time): Check Span (>24h), Rows (>30), Distortion (IQR Check).
    *   Identify **The Atom** (Title/ID): Fallback check.

### 2.3 [NEW] Strategy Determination (The "Succession Law")
*   `determine_primary_intent(roles) -> (Strategy, AnchorType)`:
    *   **Rule 1 (Time)**: If `Time.valid`, return `TEMPORAL_SUPREME`.
    *   **Rule 2 (Context)**: Else If `Cluster.valid`, return `SNAPSHOT_PIVOT` (Anchor=Cluster).
    *   **Rule 3 (Class)**: Else If `Class.valid`, return `SNAPSHOT_PIVOT` (Anchor=Classification).
    *   **Rule 4 (Atom)**: Else If `Title.valid`, return `SNAPSHOT_PIVOT` (Anchor=Title).
    *   **Rule 5 (Last Resort)**: Else If `Metric.valid`, return `SNAPSHOT_PIVOT` (Anchor=Histogram).
    *   **Rule 6 (Degenerate)**: Else `KPI_MODE`.

---

## Phase 3: Visual Generators

### 3.1 [NEW] Temporal Generators
*   `_build_temporal_anchor(df)`:
    *   **Aggregator**: `Bin` by optimal granularity (Day/Week).
    *   **Metric**: Count + Mean Sentiment (if valid).
    *   **Visual**: Combo Chart (Area=Vol, Line=Sent). or MultiLine.

### 3.2 [NEW] Snapshot Generators
*   `_build_cluster_anchor(df)`:
    *   **Aggregator**: Group by Cluster.
    *   **Overflow Logic**: Sort desc. Take Top 10. Sum rest to `(Others)` (Grey).
    *   **Stacking**: If `Class.valid` (2-5), Stack. Else Simple Bar.
    *   **Polarization**: Check `Variance > 0.4`. If yes, color Purple (unless Stacked).

### 3.3 [NEW] Fallback Generators
*   `_build_histogram_anchor(df)`: 10 bins, colored by mean sentiment of bin.
*   `_build_kpi_card(df)`: "Total Items: X".

---

## Phase 4: Integration & Verification

### 4.1 [VERIFY] `app/services/report.py` (Orchestrator)
*   **Factory**: Ensure `generate_report_payload` uses `AnalysisEngine` strictly.

### 4.2 [TEST] Manual Verification Plans
*   **Time Test**: Upload 7-day dataset. Expect Line Chart.
*   **Cluster Test**: Upload 20-cluster dataset. Expect Horizontal Bar (Top 10+Others).
*   **Orphan Test**: Upload ID+Sentiment. Expect Histogram.
*   **Degenerate Test**: Upload 1 row. Expect KPI Card.
