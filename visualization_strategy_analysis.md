# Visualization Strategy: Hyperanalysis
**"The Dependency Pivot & Merge Logic"**

## 1. Executive Summary
The proposed "Pivot & Merge" logic is **Excellent** and significantly superior to standard "chart picking" algorithms. By anchoring on the `Classification` field (the "Sun") and treating others as "Satellites", it guarantees a dense, high-signal visualization 100% of the time, solving the "Blank Dashboard" problem.

However, strict adherence to the current satellites (`Title`, `Confidence`, `Cluster`, `Timestamp`) exposes 3 specific "Black Holes" (Edge Cases) that must be plugged to make it truly bulletproof.

---

## 2. Strengths (The "Why it works")
*   **Guaranteed Anchor**: Since `Classification` is immutable, we never show an error state. At worst, we show a basic Distribution Bar.
*   **Zero Redundancy**: Embedding `Confidence` as a dual-axis line (Candidate A) allows us to show "Volume" and "Quality" in one pixel space. This is "High Density" perfectly executed.
*   **Scalability**: The fallback to Treemap (Candidate C) handles the "High Cardinality" problem where most dashboards break (e.g., 50 Games).

---

## 3. The "Black Holes" (Critical Gaps)

### Gap 1: The "Temporal" Void
*   **Issue**: `Timestamp` is listed as a satellite, but **none of the 3 Candidates use it as a Primary Axis**.
*   **Scenario**: User uploads "Server Logs". `Title` is "Server A". `Classification` is "Error".
    *   *Result*: Candidate A shows "Error Count by Server".
    *   *Missing*: "When did the errors happen?"
*   **Fix**: **Candidate D (The "Stream" View)** MUST be added.
    *   **Logic**: High Volume + Timestamp Present.
    *   **Visual**: Stacked Area Chart (Streamgraph).
    *   **Axis**: X=Time, Y=Volume, Color=Classification.

### Gap 2: The "Uniform" Confidence Trap
*   **Issue**: Candidate A uses `Confidence` as the Line Overlay.
*   **Scenario**: User uploads "Manual Labels" (Confidence = 100% everywhere) or "Dumb Model" (Confidence = 0.5 everywhere).
*   **Result**: The Line Chart is a flat line. It adds **Zero Information** and purely adds visual noise/clutter.
*   **Refinement**: The Backend "Dependency Scan" must calculate `variance(confidence)`. If `variance < threshold`, **Disable Line Overlay**.

### Gap 3: Color Consistency (The "Rainbow" Risk)
*   **Issue**: "Smart-Switch" allows changing views.
*   **Scenario**: In "Bar Chart", 'Bug' is Red. In "Treemap", 'Bug' is Blue.
*   **Impact**: Destroys cognitive load. "Red" must always mean "Bug".
*   **Fix**: The Backend `anchor_widget` payload must return a global `color_map` dictionary (e.g., `{"Bug": "#FF0000", "Feature": "#00FF00"}`) that ALL widgets obey.

---

## 4. Refined "Smart-Switch" Payload
We will enhance the contract to include `color_map` and the `variance` check.

```json
{
  "anchor_widget": {
    "title": "Sentiment Performance Analysis",
    "global_color_map": {
       "Positive": "#10B981",
       "Negative": "#EF4444",
       "Neutral": "#6B7280"
    },
    "options": [
      {
        "id": "view_combo",
        "label": "Consolidated View",
        "type": "COMBO_DUAL_AXIS",
        "requirements": ["variance(confidence) > 0.05"] 
      },
      {
        "id": "view_stream",
        "label": "Temporal Evolution", 
        "type": "STREAMGRAPH",
        "requirements": ["has_timestamp"]
      }
    ]
  }
}
```

## 5. Verdict
**Approved with Refinements.**
Proceed with the implementation of the Ingestion Worker, but **ADD** the "Streamgraph" (Candidate D) and the "Variance Check" logic to the backend scan.
