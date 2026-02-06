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
    PIE_CHART = "PIE_CHART"

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

class PieChartWidget(BaseWidget):
    type: Literal[WidgetType.PIE_CHART] = WidgetType.PIE_CHART
    categories: List[str]
    series: List[Dict[str, Any]]

class ComboChartWidget(BaseWidget):
    type: Literal[WidgetType.COMBO_CHART] = WidgetType.COMBO_CHART
    x_axis: List[Any]
    bar_series: List[Dict[str, Any]]
    line_series: List[Dict[str, Any]]

class ScatterWidget(BaseWidget):
    type: Literal[WidgetType.SCATTER_PLOT] = WidgetType.SCATTER_PLOT
    data_points: List[Dict[str, Any]]

# Polymorphic Type for "Any Widget"
WidgetObject = Union[MultiLineWidget, BarChartWidget, PieChartWidget, ComboChartWidget, ScatterWidget]

# --- The Response Reality (Tagged Union) ---

class TemporalPayload(BaseModel):
    """
    Option A: The Dictator.
    Time exists. You see the Timeline.
    """
    layout_strategy: Literal["TEMPORAL_SUPREME"] = "TEMPORAL_SUPREME"
    meta: Dict[str, Any]
    
    # Single Source of Truth
    anchor_visual: WidgetObject

class SnapshotPayload(BaseModel):
    """
    Option B: The Negotiator.
    Time is missing. You choose the view.
    """
    layout_strategy: Literal["SNAPSHOT_PIVOT"] = "SNAPSHOT_PIVOT"
    meta: Dict[str, Any]
    
    # The Options Menu
    anchor_options: List[WidgetObject]
    default_option_index: int = 0

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
