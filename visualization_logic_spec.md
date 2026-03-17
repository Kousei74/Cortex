# CORTEX Visualization Logic: The Dependency Pivot (V1 Spec)

## 1. Core Philosophy
CORTEX is a specialized dashboard for a specific Review Classification Pipeline.
*   **The "Sun" (Immutable)**: `Classification` (Nominal). ALWAYS present.
*   **The "Core" (High Prob)**: `Title` (Game/Entity), `Confidence` (Model Score), `Cluster`, `ID`.
*   **The "Variable"**: `Timestamp`, `Publisher`, `Source`.

**Logic**: We do not "guess". We pivot around `Classification` and merge available "Satellites" into the highest-density visual possible.

---

## 2. Ingestion Logic (The "Satellite Scan")

The Backend worker scans the dataset columns to detect satellites.

| Satellite | Data Type | Usage |
| :--- | :--- | :--- |
| **Title** | Nominal | **X-Axis** (Primary Grouper) |
| **Confidence** | Float (0-1) | **Y-Axis 2** (Line Overlay) - *Always overlay if present* |
| **Cluster** | Nominal | **Filter/Facet** (Drill-down) |
| **Timestamp** | DateTime | **X-Axis** (Temporal View) |

---

## 3. The Layout Logic (The "Smart-Switch")

The backend generates a list of **Valid Widgets** based on available satellites. It then decides the **Layout Strategy**.

### **Scenario A: The "Temporal Supreme" (Timestamp Exists)**
*   **Condition**: `Timestamp` satellite detected.
*   **Anchor Widget**: **Multi-Line Area Chart** (Pos/Neg/Neu over Time).
    *   *No Dropdown*. This view is mandatory as the Head.
*   **Subordinate Widgets**: All other valid candidates (Title Combo, Cluster Divergence, etc.) are rendered **below** the Anchor.

### **Scenario B: The "Snapshot" (Timestamp Absent)**
*   **Condition**: No `Timestamp` found.
*   **Anchor Widget**: Defaults to priority order:
    1.  **Title/Entity** (Candidate A).
    2.  **Cluster** (Candidate C).
*   **Dropdown**: **Enabled**. User can swap the Anchor.
*   **Subordinate Widgets**: All *other* non-selected candidates are rendered **below**.

---

## 4. Candidate Definitions

| Candidate | Trigger | Visual | Role |
| :--- | :--- | :--- | :--- |
| **Temporal** | `Timestamp` | **Multi-Line Area** (3 lines: Pos/Neg/Neu) | **Anchor** (Scenario A) |
| **Consolidated** | `Title` | **Dual-Axis Combo** (Bar=Vol, Line=Conf) | **Anchor** (Scenario B) or Subordinate |
| **Diverging** | `Cluster` | **Diverging Bar** (Left=Neg, Right=Pos) | Subordinate |
| **Scale** | `Title` + High Card | **Treemap** | Subordinate/Fallback |

---

## 5. The API Contract (JSON Response)

```json
{
  "report_id": "rep_uuid",
  "layout_strategy": "TEMPORAL_SUPREME", // or "SNAPSHOT_PIVOT"
  "global_color_map": { ... },
  
  "anchor_widget": {
    "id": "view_temporal",
    "type": "MULTI_LINE_AREA",
    "data": [...],
    "config": { ... },
    "allow_switch": false // True only in Scenario B
  },
  
  "subordinate_widgets": [
    {
      "id": "view_combo",
      "type": "COMBO_DUAL_AXIS",
      "title": "Performance by Title",
      "data": [...]
    },
    {
      "id": "view_diverging",
      "type": "DIVERGING_BAR",
      "title": "Cluster Analysis",
      "data": [...]
    }
  ]
}
```

---

## 5. Implementation Roadmap (Backend)

1.  **Ingestion Worker (`core/ingestion.py`)**:
    *   Add `detect_satellites(df)` function.
    *   Add `aggregators.py` to perform the GroupBy operations for each Candidate.
    *   Add `color_generator.py` to assign consistent colors to Classification labels.
2.  **API Endpoint (`api/endpoints/reports.py`)**:
    *   Receive File IDs.
    *   Load DataFrames (Pandas).
    *   Run `detect_satellites` -> Pick Anchor -> Run Aggregation -> Return JSON.
