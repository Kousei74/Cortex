from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union, Literal
from enum import Enum

# --- Enums ---
class WidgetType(str, Enum):
    MULTI_LINE_AREA = "MULTI_LINE_AREA"
    STACKED_BAR = "STACKED_BAR"
    SCATTER_PLOT = "SCATTER_PLOT"
    COMBO_CHART = "COMBO_CHART"
    STATS_CARD = "STATS_CARD"
    HISTOGRAM = "HISTOGRAM"
    KPI_CARD = "KPI_CARD"
    DONUT = "DONUT"
    TREEMAP = "TREEMAP"

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# --- Widget Logic (The "Gold Standard" Objects) ---

class BaseWidget(BaseModel):
    id: str = Field(..., description="Unique ID")
    title: str = Field(..., description="User-facing title")
    aspect_ratio: float = Field(..., description="Preferred Aspect Ratio (Width/Height)")

class MultiLineWidget(BaseWidget):
    type: Literal[WidgetType.MULTI_LINE_AREA] = WidgetType.MULTI_LINE_AREA
    x_axis: List[Any]
    series: List[Dict[str, Any]]

class BarChartWidget(BaseWidget):
    type: Literal[WidgetType.STACKED_BAR] = WidgetType.STACKED_BAR
    categories: List[str]
    series: List[Dict[str, Any]]

class HistogramWidget(BaseWidget):
    type: Literal[WidgetType.HISTOGRAM] = WidgetType.HISTOGRAM
    bins: List[str]
    series: List[Dict[str, Any]]

class KPICardWidget(BaseWidget):
    type: Literal[WidgetType.KPI_CARD] = WidgetType.KPI_CARD
    value: Union[int, float, str]
    label: str
    context: Optional[str] = None

class ComboChartWidget(BaseWidget):
    type: Literal[WidgetType.COMBO_CHART] = WidgetType.COMBO_CHART
    x_axis: List[Any]
    bar_series: List[Dict[str, Any]]
    line_series: List[Dict[str, Any]]

class ScatterWidget(BaseWidget):
    type: Literal[WidgetType.SCATTER_PLOT] = WidgetType.SCATTER_PLOT
    data_points: List[Dict[str, Any]]

class DonutWidget(BaseWidget):
    """Sentiment class distribution as a donut chart (sub-anchor visual 1)."""
    type: Literal["DONUT"] = "DONUT"
    slices: List[Dict[str, Any]]  # [{name, value, percentage}]

class TreemapWidget(BaseWidget):
    """Title or cluster distribution as a treemap (sub-anchor visual 2, isTimestamp=False)."""
    type: Literal["TREEMAP"] = "TREEMAP"
    nodes: List[Dict[str, Any]]   # [{name, value}]

# Polymorphic Type for "Any Widget"
WidgetObject = Union[
    "TemporalAnchorWidget", # Forward ref or defined below
    MultiLineWidget, BarChartWidget, ComboChartWidget, ScatterWidget,
    HistogramWidget, KPICardWidget, DonutWidget, TreemapWidget
]

# --- Special Anchor Widgets ---

class TemporalResolution(BaseModel):
    label: str # "Yearly", "Quarterly", "Monthly"
    x_axis: List[str]
    series: List[Dict[str, Any]] # The lines/areas

class TemporalAnchorWidget(BaseWidget):
    type: Literal["TEMPORAL_ANCHOR"] = "TEMPORAL_ANCHOR"
    resolutions: Dict[str, TemporalResolution] # keys: 'Y', 'Q', 'M'
    default_resolution: str = 'M'


class SubAnchorBlock(BaseModel):
    """
    The sub-anchor row: always two visuals.
    donut = sentiment distribution (always present)
    secondary = line chart if isTimestamp, treemap otherwise
    """
    donut: DonutWidget
    secondary_type: Literal["LINE", "TREEMAP"]
    secondary: Union["TemporalAnchorWidget", TreemapWidget]


# --- The Response Reality (Tagged Union) ---


class TemporalPayload(BaseModel):
    """
    Option A: The Dictator.
    Time exists. Anchor is always the stacked bar chart.
    isTimestamp governs sub-anchor 2nd visual only.
    """
    layout_strategy: Literal["TEMPORAL_SUPREME"] = "TEMPORAL_SUPREME"
    is_timestamp: bool = True
    meta: Dict[str, Any]

    # Anchor is always the stacked bar chart
    anchor_visual: BarChartWidget
    # Sub-anchor row (donut + line chart)
    sub_anchor: Optional[SubAnchorBlock] = None


class SnapshotPayload(BaseModel):
    """
    Option B: The Negotiator.
    Time is missing. Anchor is always the stacked bar chart.
    isTimestamp governs sub-anchor 2nd visual only.
    """
    layout_strategy: Literal["SNAPSHOT_PIVOT"] = "SNAPSHOT_PIVOT"
    is_timestamp: bool = False
    meta: Dict[str, Any]

    # Anchor is always the stacked bar chart
    anchor_options: List[WidgetObject]
    default_option_index: int = 0
    # Sub-anchor row (donut + treemap)
    sub_anchor: Optional[SubAnchorBlock] = None

class UnsupportedPayload(BaseModel):
    """
    Option C: The Fallback.
    Data didn't meet requirements.
    """
    layout_strategy: Literal["UNSUPPORTED_DATASET"] = "UNSUPPORTED_DATASET"
    meta: Dict[str, Any]
    reason_code: str
    missing_requirements: List[str]

# The Master Union
ReportPayload = Union[TemporalPayload, SnapshotPayload, UnsupportedPayload]

# --- API Models ---

class ReportRequest(BaseModel):
    file_ids: List[str] = Field(..., min_items=1, max_items=10)
    project_id: str

class ReportResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(0, ge=0, le=100)
    error: Optional[str] = None
    payload: Optional[ReportPayload] = None
    is_existing: bool = Field(False, description="True if job was idempotent (already existed)")
