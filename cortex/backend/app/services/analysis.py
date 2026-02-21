import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple, Union
import os
import uuid
import json
import logging
import ast

from app.schemas.report import (
    ReportPayload, TemporalPayload, SnapshotPayload, UnsupportedPayload,
    WidgetObject, MultiLineWidget, BarChartWidget, ComboChartWidget, 
    ScatterWidget, HistogramWidget, KPICardWidget, WidgetType,
    TemporalAnchorWidget, TemporalResolution,
    DonutWidget, TreemapWidget, SubAnchorBlock
)
from app.core.config import settings
from app.services.ingestion import load_dataset

# Configuration from Constitution
MAX_CLUSTERS = settings.MAX_CLUSTERS
MIN_ROWS_TIME = settings.MIN_ROWS_TIME
METRIC_DENSITY_THRESHOLD = settings.METRIC_DENSITY_THRESHOLD
TIME_DOMAIN_IQR_THRESHOLD = settings.TIME_DOMAIN_IQR_THRESHOLD

logger = logging.getLogger(__name__)

# --- NORMALIZATION & HYGIENE ---

def normalize_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Sanitizes the dataframe according to the Constitution.
    Returns: (Cleaned DF, Metadata about dropped/coerced things)
    """
    meta = {"transformations": []}
    
    # 1. Column Mapping (Definition)
    # Format: { StandardColumn: [aliases...] }
    definition_map = {
        'Cluster': ['category_cluster', 'category', 'topic', 'cluster'],
        'Sentiment': ['average_polarity', 'polarity', 'rating', 'score', 'sentiment'],
        'SentimentClass': [], # Deprecated, merged into Classification
        'ID': ['id'],
        'Timestamp': ['timestamp', 'date', 'created_at', 'time'],
        # GameTitle: categorical product/series names (low cardinality, short values)
        # These are game names, series names, publisher names — NOT review text.
        'GameTitle': [
            'game', 'game_title', 'game title',
            'game_series', 'game series', 'series',
            'app', 'app_title', 'app title',
            'product', 'product_name', 'product name',
            'publisher', 'creator',
        ],
        # ReviewTitle: the individual review's headline/subject line
        # This is kept separate to avoid polluting the categorical treemap.
        'ReviewTitle': [
            'title', 'headline', 'name',
        ],
        'Confidence': ['confidence', 'score_confidence'],
    }
    
    # Flatten for O(1) Lookup: { 'alias': 'Standard' }
    normalization_map = {
        alias: standard 
        for standard, aliases in definition_map.items() 
        for alias in aliases
    }
    
    rename_map = {}
    
    # PRIORITY FIX: 'category_cluster' > 'category'
    # If both are present, we want 'category_cluster' to become 'Cluster'.
    # But standard loop might pick 'category' first.
    # We pre-seed the rename map to force the winner.
    
    cluster_cols = [c for c in df.columns if c.lower().strip() == 'category_cluster']
    if cluster_cols:
        rename_map[cluster_cols[0]] = 'Cluster'
        # Prevent 'category' from being renamed to Cluster?
        # Yes, map 'category' to something else or ignore it for the Cluster role.
        # We can't easily "ignore" it in the loop below without complex logic.
        # But if 'Cluster' is already in rename_map.values(), the loop checks that!
        # "if standard not in df.columns and standard not in rename_map.values():"
        # So pre-seeding works!

    for col in df.columns:
        if col in rename_map: continue # Already handled
        
        lower = col.lower().strip()
        # Normalize spaces to underscores so 'Game Title' matches 'game_title'
        lower_normalized = lower.replace(' ', '_')
        # Try both: exact lowercase and underscore-normalized form
        matched_key = lower if lower in normalization_map else (
            lower_normalized if lower_normalized in normalization_map else None
        )
        if matched_key is not None:
            standard = normalization_map[matched_key]
            if standard not in df.columns and standard not in rename_map.values():
                rename_map[col] = standard
    
    if rename_map:
        df = df.rename(columns=rename_map)
        meta["transformations"].append(f"Renamed columns: {rename_map}")

    # 2. Type Coercion
    
    # Timestamp
    if 'Timestamp' in df.columns:
        if not pd.api.types.is_datetime64_any_dtype(df['Timestamp']):
            df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
    
    # Sentiment / Confidence (Strict Float)
    for metric in ['Sentiment', 'Confidence']:
        if metric in df.columns:
            df[metric] = pd.to_numeric(df[metric], errors='coerce')
    
    # Text Columns (Lowercasing + Parsing)
    text_cols = ['Title', 'Cluster', 'Classification', 'SentimentClass']
    for col in text_cols:
        if col in df.columns:
            # Handle List-Strings for Cluster (e.g., "['tag1', 'tag2']")
            if col == 'Cluster' and df[col].dropna().astype(str).str.startswith('[').any():
                 try:
                    def safe_parse(x):
                        try:
                            val = ast.literal_eval(str(x))
                            return val[0] if isinstance(val, list) and val else None # Take first tag for now
                        except:
                            return str(x)
                    df[col] = df[col].apply(safe_parse)
                 except:
                     pass

            df[col] = df[col].fillna("(Unclassified)")
            # Standardize 'nan', 'none' -> (Unclassified)
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace(r'(?i)^(nan|none|null|)$', "(Unclassified)", regex=True)
            
            # Title Special Handling
            if col == 'Title':
                 df[col] = df[col].replace("(Unclassified)", "Untitled")

    # 2.5 Filters (Business Logic)
    if 'Cluster' in df.columns:
        # User requested to ignore "spaCy_noun"
        df = df[df['Cluster'].str.lower() != 'spacy_noun']
        df = df[df['Cluster'].str.lower() != 'spacynoun'] # Variance check

    # 3. Metric Validity Check & Optimization
    dropped_metrics = []
    for metric in ['Sentiment', 'Confidence']:
        if metric in df.columns:
            # Vectorized density check
            valid_count = df[metric].notna().sum()
            density = valid_count / len(df) if len(df) > 0 else 0
            
            if density < METRIC_DENSITY_THRESHOLD:
                df = df.drop(columns=[metric])
                dropped_metrics.append(metric)
    
    if dropped_metrics:
        meta["transformations"].append(f"Dropped sparse metrics: {dropped_metrics}")

    # 4. MEMORY OPTIMIZATION (Categoricals)
    # Convert low-cardinality string columns to categories
    for col in ['Cluster', 'Classification', 'Title']:
        if col in df.columns and df[col].dtype == 'object':
            num_unique = df[col].nunique()
            if num_unique < len(df) * 0.5: # Heuristic: <50% unique
                df[col] = df[col].astype('category')

    return df, meta

# --- ALGORITHMS ---

def lttb_downsample(df: pd.DataFrame, time_col: str, value_col: str, threshold: int = 500) -> pd.DataFrame:
    """
    Largest-Triangle-Three-Buckets (LTTB) Downsampling.
    Reduces points while preserving visual shape.
    """
    if len(df) <= threshold:
        return df

    # Bucket size
    every = (len(df) - 2) / (threshold - 2)
    
    a = 0
    next_a = 0
    
    sampled = [df.iloc[0]] # Always keep first
    
    # Pre-convert to numpy for speed
    timestamps = df[time_col].astype(np.int64) // 10**9 # Convert to seconds
    values = df[value_col].fillna(0).values
    
    for i in range(threshold - 2):
        # Calculate bucket boundaries
        avg_range_start = int(np.floor((i + 1) * every) + 1)
        avg_range_end = int(np.floor((i + 2) * every) + 1)
        avg_range_end = min(avg_range_end, len(df))
        
        avg_range_start = max(avg_range_start, next_a + 1)
        
        # Calculate Point C (Average of next bucket)
        if avg_range_end > avg_range_start:
            avg_x = np.mean(timestamps[avg_range_start:avg_range_end])
            avg_y = np.mean(values[avg_range_start:avg_range_end])
        else:
            avg_x = timestamps[next_a]
            avg_y = values[next_a]
            
        # Point A is sampled[-1]
        a_row = sampled[-1]
        a_x = a_row[time_col].value // 10**9
        a_y = a_row[value_col] if pd.notna(a_row[value_col]) else 0
        
        # Find Point B (Max Triangle Area in current bucket)
        range_offs = int(np.floor((i + 0) * every) + 1)
        range_to = int(np.floor((i + 1) * every) + 1)
        range_offs = max(range_offs, next_a + 1) # Ensure forward progress
        
        max_area = -1
        max_area_idx = range_offs
        
        # Iterate over current bucket (vectorization is hard here without extensive numpy tricks, loop is ok for <10k)
        # For very large datasets, we might want a simpler stride decimation.
        # But let's try strict LTTB.
        
        for idx in range(range_offs, min(range_to, len(df))):
            x = timestamps[idx]
            y = values[idx]
            
            # Triangle Area: 0.5 * |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)|
            area = 0.5 * abs(
                a_x * (y - avg_y) + 
                x * (avg_y - a_y) + 
                avg_x * (a_y - y)
            )
            
            if area > max_area:
                max_area = area
                max_area_idx = idx
        
        sampled.append(df.iloc[max_area_idx])
        next_a = max_area_idx

    sampled.append(df.iloc[-1]) # Always keep last
    return pd.DataFrame(sampled)

# --- ROLE DETECTION ---

def detect_roles(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Identifies the semantic role of each column based on cardinality and shape.
    """
    roles = {
        "Time": {"valid": False, "span_hours": 0, "rows": 0},
        "Cluster": {"valid": False, "cardinality": 0, "status": "missing"},
        "Classification": {"valid": False, "cardinality": 0, "status": "missing"},
        "Title": {"valid": False, "cardinality": 0},
        "Sentiment": {"valid": False},
        "Confidence": {"valid": False}
    }
    
    # 1. Time (The Dictator)
    if 'Timestamp' in df.columns:
        valid_ts = df['Timestamp'].dropna()
        if not valid_ts.empty:
            rows = len(valid_ts)
            span = (valid_ts.max() - valid_ts.min()).total_seconds() / 3600
            
            # IQR Check for Distortion
            # Calculate IQR (Q3 - Q1)
            q1 = valid_ts.quantile(0.25)
            q3 = valid_ts.quantile(0.75)
            iqr_seconds = (q3 - q1).total_seconds()
            total_range_seconds = (valid_ts.max() - valid_ts.min()).total_seconds()
            
            is_distorted = False
            if iqr_seconds > 0 and total_range_seconds > (TIME_DOMAIN_IQR_THRESHOLD * iqr_seconds):
                is_distorted = True
                roles["Time"]["distorted"] = True
                # Store valid domain for clamping if needed
                roles["Time"]["clamp_domain"] = [q1, q3]

            # PATCH 1: Enforce Time Bin Count
            # Must have at least 3 distinct days to be a "Time Series"
            distinct_bins = valid_ts.dt.floor('D').nunique()
            
            if rows >= MIN_ROWS_TIME and span >= 24 and distinct_bins >= 3:
                roles["Time"].update({"valid": True, "span_hours": span, "rows": rows})
            else:
                roles["Time"]["reason"] = "Insufficient rows, span < 24h, or < 3 bins"
    
    # 2. Cluster (The Context)
    if 'Cluster' in df.columns:
        counts = df['Cluster'].value_counts()
        card = len(counts)
        unclassified_share = counts.get("(Unclassified)", 0) / len(df) if len(df) > 0 else 0
        
        roles["Cluster"]["cardinality"] = card
        
        if card < 2 and unclassified_share < 1.0: # Allow mono if explicit valid tag? No, banning mono implies >1 group needed.
             roles["Cluster"]["status"] = "mono_cluster_banned"
        elif card > 50:
             roles["Cluster"]["status"] = "fragmented_banned"
        elif unclassified_share > 0.5:
              roles["Cluster"]["status"] = "unclassified_dominance"
        else:
             # PATCH 3: Fragmentation Fail-Safe
             largest_share = counts.iloc[0] / len(df)
             others_share = counts.iloc[1:].sum() / len(df) if len(counts) > 1 else 0
             
             if others_share > 0.5 and largest_share < 0.2:
                 roles["Cluster"]["valid"] = False
                 roles["Cluster"]["status"] = "fragmentation_fail"
             else:
                 roles["Cluster"]["valid"] = True

    # 3. Classification (The Sun)
    if 'Classification' in df.columns:
        counts = df['Classification'].value_counts()
        card = len(counts)
        unclassified_share = counts.get("(Unclassified)", 0) / len(df) if len(df) > 0 else 0
        
        # PATCH 6: Enforce Classification <= 5 For Stacking
        if 2 <= card <= 5 and unclassified_share <= 0.5:
            roles["Classification"] = {"valid": True, "cardinality": card}
        else:
             roles["Classification"]["status"] = "cardinality_violation"

    # 4. Title (The Atom)
    if 'Title' in df.columns:
        roles["Title"] = {"valid": True, "cardinality": df['Title'].nunique()}
        
    # 5. Metrics
    if 'Sentiment' in df.columns: roles["Sentiment"]["valid"] = True
    if 'Confidence' in df.columns: roles["Confidence"]["valid"] = True

    return roles

# --- INTENT SUCCESSION ---

def determine_intent(roles: Dict[str, Any]) -> Tuple[str, str]:
    """
    Returns (LayoutStrategy, AnchorType) based on Constitution.
    """
    # 1. Temporal Imperative
    if roles["Time"]["valid"]:
        return "TEMPORAL_SUPREME", "Time"
    
    # 2. Snapshot Succession
    if roles["Cluster"]["valid"]:
        return "SNAPSHOT_PIVOT", "Cluster"
        
    if roles["Classification"]["valid"]:
        return "SNAPSHOT_PIVOT", "Classification"
        
    if roles["Title"]["valid"]:
        if roles["Title"]["cardinality"] > 1:
            return "SNAPSHOT_PIVOT", "Title"
        # If Title has 1 item, it's Degenerate -> Fallthrough to KPI
        
    if roles["Sentiment"]["valid"] or roles["Confidence"]["valid"]:
        return "SNAPSHOT_PIVOT", "Histogram"
        
    return "SNAPSHOT_PIVOT", "KPI"

# --- VISUAL GENERATORS ---

def _build_temporal_anchor(df: pd.DataFrame, roles: Dict) -> WidgetObject:
    """
    Generates a Multi-Resolution Temporal Anchor (Year, Quarter, Month).
    Returns a TemporalAnchorWidget.
    """
    valid_df = df.dropna(subset=['Timestamp'])
    
    # PATCH 2: Enforce IQR Clamp
    if roles["Time"].get("distorted") and "clamp_domain" in roles["Time"]:
        lower, upper = roles["Time"]["clamp_domain"]
        valid_df = valid_df[
            (valid_df["Timestamp"] >= lower) &
            (valid_df["Timestamp"] <= upper)
        ]
        
    # PATCH 4: Degenerate Visualization Enforcement (Temporal)
    # If total valid points < 2, return KPI
    if len(valid_df) <= 1:
        return _build_kpi_card(df)

    resolutions = {}
    
    # Helper to build one resolution
    def build_res(freq_code, label):
        try:
            grouped = valid_df.groupby(pd.Grouper(key='Timestamp', freq=freq_code))
            agg_funcs = {'ID': 'count'}
            if 'Sentiment' in df.columns:
                agg_funcs['Sentiment'] = 'mean'
            
            res = grouped.agg(agg_funcs).rename(columns={'ID': 'count', 'Sentiment': 'sentiment'}).reset_index()
            res = res.sort_values('Timestamp')
            
            # Filter empty bins if needed? No, time series usually wants 0s for gaps, 
            # but pandas freq grouper creates them. FillNA.
            
            # LTTB Downsample only if HUGE (e.g. > 500 points for daily, but for Y/Q/M it's usually small)
            # Monthly over 10 years = 120 points. Safe.
            
            series = [{
                "name": "Volume", 
                "type": "area", 
                "data": res['count'].fillna(0).tolist(),
                "color": "#3b82f6" 
            }]
            
            if 'Sentiment' in df.columns:
                series.append({
                    "name": "Sentiment", 
                    "type": "line", 
                    "data": res['sentiment'].fillna(0).round(2).tolist(),
                    "color": "#10b981"
                })
                
            return TemporalResolution(
                label=label,
                x_axis=res['Timestamp'].dt.strftime('%Y-%m-%d').tolist(),
                series=series
            )
        except Exception as e:
            logger.error(f"Failed to build resolution {label}: {e}")
            return None

    # Specific Frequencies
    # Y = Year (AS), Q = Quarter (Q), M = Month (M)
    resolutions['Y'] = build_res('AS', 'Yearly')
    resolutions['Q'] = build_res('Q', 'Quarterly')
    resolutions['M'] = build_res('M', 'Monthly')
    
    # Filter out Nones
    resolutions = {k: v for k, v in resolutions.items() if v is not None}
    
    if not resolutions:
         return _build_kpi_card(df)

    return TemporalAnchorWidget(
        id="temporal_anchor", title="", aspect_ratio=2.5, # Empty title as requested
        resolutions=resolutions,
        default_resolution='M'
    )

def _build_cluster_anchor(df: pd.DataFrame, roles: Dict) -> WidgetObject:
    """
    Generates a 100% Stacked Bar Chart of Cluster vs Classification.
    NO 'Others' category - Show ALL clusters.
    """
    # Group by Cluster AND Classification
    if 'Classification' not in df.columns:
        # Fallback if no classification: Just volume bars (100% of... nothing? No, just single color)
        # But we technically enforced Classification logic or filled it?
        # Let's assume Classification exists or was coerced to (Unclassified).
        return _build_cluster_fallback(df) # Logic for simple bars if strict dependency fails?

    # Prepare Data
    # Rows: Clusters
    # Cols: Classifications
    # Values: Count
    
    ctab = pd.crosstab(df['Cluster'], df['Classification'])
    
    # Sort by Total Volume (Descending)
    ctab['total'] = ctab.sum(axis=1)
    ctab = ctab.sort_values('total', ascending=False)
    
    # Drop total col for rendering, but keep order
    ctab = ctab.drop(columns=['total'])
    
    # Normalize to Percentage (Sum of row = 100)
    # We actually want RAW counts for tooltip, but Percentage for Bar Height (which is handled by FE usually if allowed)
    # BUT user said "y: percentage".
    # Typically Recharts "stacked bar" uses raw numbers and duplicates them to max, OR we normalize here.
    # To get "100% height" bars in Recharts, we usually use `stackOffset="expand"`.
    # So we send RAW counts, and let Frontend verify `stackOffset="expand"`.
    
    # However, user said "each cluster bar should be divided into the sentiment class percentage values".
    # Sending RAW counts is safer for tooltips.
    
    categories = ctab.index.tolist()
    series = []
    
    # Dynamic Colors for Classifications? 
    # We need a palette.
    palette = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#8b5cf6"]
    
    for idx, col in enumerate(ctab.columns):
        series.append({
            "name": col, # Classification Name
            "data": ctab[col].tolist(),
            "color": palette[idx % len(palette)]
        })
        
    return BarChartWidget(
        id="cluster_anchor", title="", aspect_ratio=2.0, # Empty title
        categories=categories,
        series=series
        # Frontend must treat this as stacked 100%
    )

def _build_cluster_fallback(df: pd.DataFrame) -> WidgetObject:
    # Just simple volume
    counts = df['Cluster'].value_counts()
    return BarChartWidget(
        id="cluster_anchor_simple", title="", aspect_ratio=2.0,
        categories=counts.index.tolist(),
        series=[{"name": "Count", "data": counts.values.tolist(), "color": "#3b82f6"}]
    )

def _build_classification_anchor(df: pd.DataFrame) -> WidgetObject:
    # Simple Count, No "Others", limited cardinality (2-12)
    # Simple Count, No "Others", limited cardinality (2-12)
    counts = df['Classification'].value_counts()
    
    # PATCH 4: Degenerate Visualization Enforcement (Classification)
    if len(counts) <= 1:
        return _build_kpi_card(df)
    
    return BarChartWidget(
        id="class_anchor", title="Classification Distribution", aspect_ratio=1.5,
        categories=counts.index.tolist(),
        series=[{"name": "Count", "data": counts.values.tolist()}]
    )

def _build_atom_anchor(df: pd.DataFrame) -> WidgetObject:
    # Top 20 Titles
    counts = df['Title'].value_counts().head(20)
    
    return BarChartWidget(
        id="atom_anchor", title="Top Entities", aspect_ratio=1.5,
        categories=counts.index.tolist(),
        series=[{"name": "Frequency", "data": counts.values.tolist()}]
    )

def _build_histogram_anchor(df: pd.DataFrame) -> WidgetObject:
    metric = 'Sentiment' if 'Sentiment' in df.columns else 'Confidence'
    data = df[metric].dropna()
    
    # 10 Bins
    counts, bins = np.histogram(data, bins=10, range=(-1, 1) if metric == 'Sentiment' else (0, 1))
    
    # Labels "0.1 to 0.3"
    bin_labels = [f"{bins[i]:.1f} to {bins[i+1]:.1f}" for i in range(len(bins)-1)]
    
    return HistogramWidget(
        id="histogram_anchor", title=f"{metric} Distribution", aspect_ratio=1.5,
        bins=bin_labels,
        series=[{"name": "Count", "data": counts.tolist()}]
    )

def _build_kpi_card(df: pd.DataFrame) -> WidgetObject:
    return KPICardWidget(
        id="degenerate_card", title="Summary", aspect_ratio=1.0,
        value=len(df), label="Total Items", context="Insufficient variation for visualization."
    )

def _build_sentiment_donut(df: pd.DataFrame) -> DonutWidget | None:
    """
    Aggregates the Classification column into a donut chart.
    Returns None if Classification is missing or degenerate.
    """
    if 'Classification' not in df.columns:
        return None
    counts = df['Classification'].value_counts()
    # Remove unclassified if it's minority, keep if it's the only class
    counts = counts[counts.index != "(Unclassified)"] if len(counts) > 1 else counts
    if counts.empty:
        return None
    total = counts.sum()
    slices = [
        {"name": name, "value": int(val), "percentage": round(int(val) / total * 100, 1)}
        for name, val in counts.items()
    ]
    return DonutWidget(
        id="sentiment_donut", title="", aspect_ratio=1.0,
        slices=slices
    )

def _build_title_treemap(df: pd.DataFrame) -> TreemapWidget:
    """
    Builds a treemap from the best available categorical column.
    Priority: GameTitle (series/product names) > ReviewTitle (if low cardinality) > Cluster
    """
    def _is_categorical(col_data, total_rows):
        """Returns True if the column looks like a categorical label (not free-text)."""
        unique_vals = col_data.dropna().unique()
        cardinality = len(unique_vals)
        if cardinality <= 1:
            return False
        cardinality_ratio = cardinality / total_rows if total_rows > 0 else 1.0
        if cardinality > 500 or cardinality_ratio > 0.10:
            return False
        median_len = pd.Series(unique_vals).astype(str).str.len().median()
        return median_len <= 50

    total_rows = len(df)
    source_col = None

    # Priority 1: GameTitle (game/series/product names)
    if 'GameTitle' in df.columns and _is_categorical(df['GameTitle'], total_rows):
        source_col = 'GameTitle'
    # Priority 2: ReviewTitle — only if it passes the categorical checks too
    elif 'ReviewTitle' in df.columns and _is_categorical(df['ReviewTitle'], total_rows):
        source_col = 'ReviewTitle'
    # Priority 3: Cluster
    elif 'Cluster' in df.columns:
        source_col = 'Cluster'

    if source_col is None:
        return TreemapWidget(id="treemap", title="", aspect_ratio=1.5, nodes=[])

    logger.info(f"[Treemap] Using source column: {source_col}")
    counts = df[source_col].value_counts().head(50)
    nodes = [
        {"name": str(name), "value": int(val)}
        for name, val in counts.items()
        if str(name) not in ("(Unclassified)", "Untitled", "nan")
    ]
    return TreemapWidget(
        id="treemap", title="", aspect_ratio=1.5,
        nodes=nodes
    )

# --- PUBLIC API ---

def generate_report_payload(file_ids: List[str], job_id: str = None) -> ReportPayload:
    # 1. Load & Merge
    dfs = []
    from app.api.endpoints.ingestion import upload_sessions
    for fid in file_ids:
        if fid in upload_sessions:
            path = upload_sessions[fid].get('file_path')
            if path and os.path.exists(path):
                try:
                    dfs.append(load_dataset(path))
                except Exception as e:
                    logger.error(f"Failed to load {fid}: {e}")
    
    if not dfs:
        return UnsupportedPayload(
            layout_strategy="UNSUPPORTED_DATASET", meta={}, reason_code="NO_DATA", missing_requirements=["No valid files"]
        )
    
    
    # 2. Smart Merge (Fact Table + Dimension Tables Strategy)
    # Replaces simple concat to handle "Split CSVs" (Features + Clusters + Classes)
    
    def smart_merge(dfs: List[pd.DataFrame]) -> pd.DataFrame:
        if not dfs: return pd.DataFrame()
        if len(dfs) == 1: return dfs[0]

        # A. Normalize IDs first (Local normalization)
        for d in dfs:
            # Case-insensitive find 'id'
            id_col = next((c for c in d.columns if c.strip().lower() == 'id'), None)
            if id_col:
                d.rename(columns={id_col: 'ID'}, inplace=True)

        # B. Separate Joinable vs Independent
        joinable = [d for d in dfs if 'ID' in d.columns]
        remainder = [d for d in dfs if 'ID' not in d.columns]

        if not joinable:
            return pd.concat(dfs, ignore_index=True)

        # C. Merge Strategy: Left Join onto "Fact Table" (Largest DF)
        # Sort by length desc (assuming largest is features/facts)
        joinable.sort(key=len, reverse=True)
        base_df = joinable[0]

        for other_df in joinable[1:]:
            # Clean duplicate columns in other_df to avoid suffix hell before merging?
            # No, merge handles it with suffixes.
            
            # Left merge: Keep all rows of base (Features), attach info from other (Classes)
            # If base has 100k rows and other has 3k (IDs), this populates the 3k IDs' features
            # and leaves others null (or matched). 
            # Note: If other_df has duplicates of ID, this explodes base. 
            # We assume dimension tables are unique on ID. 
            # To be safe, we could drop duplicates on ID in other_df if it's meant to be a dimension?
            # But maybe other_df is ALSO a fact table? 
            # Let's trust pandas merge.
            
            common_cols = set(base_df.columns) & set(other_df.columns) - {'ID'}
            
            base_df = pd.merge(base_df, other_df, on='ID', how='left', suffixes=('', '_new'))

            # D. Coalesce Columns (Resolve Overlaps)
            # If 'Cluster' is in both, usually the specialized file (smaller?) or the new one 
            # has the 'correct' value. 
            # Strategy: Prefer non-null values from the *new* merge (other_df).
            for col in common_cols:
                new_col = f"{col}_new"
                if new_col in base_df.columns:
                    base_df[col] = base_df[new_col].fillna(base_df[col])
                    base_df.drop(columns=[new_col], inplace=True)

        # D. Append Remainder
        if remainder:
            base_df = pd.concat([base_df] + remainder, ignore_index=True)
            
        return base_df

    raw_df = smart_merge(dfs)
    
    # 2. Normalize
    df, meta = normalize_frame(raw_df)
    
    # DEBUG: Column Check
    print(f"[Analysis] Columns after Normalization: {df.columns.tolist()}")

    # FALLBACK: Force 'sentiment_class' finding if Classification missing
    if 'Classification' not in df.columns:
        cand = next((c for c in df.columns if c.lower() == 'sentiment_class'), None)
        if cand:
            print(f"[Analysis] Force Renaming {cand} -> Classification")
            df.rename(columns={cand: 'Classification'}, inplace=True)
            df['Classification'] = df['Classification'].fillna("(Unclassified)")

    if len(df) == 0:
        return UnsupportedPayload(
             layout_strategy="UNSUPPORTED_DATASET", meta=meta, reason_code="EMPTY_DATASET", missing_requirements=["Rows > 0"]
        )

    # 3. Save Resolution Data (Legacy Bridge)
    if job_id:
        try:
             res_cols = [c for c in ['ID', 'Title', 'Cluster', 'Sentiment', 'Confidence'] if c in df.columns]
             if 'ID' not in df.columns:
                 df['ID'] = [str(uuid.uuid4()) for _ in range(len(df))]
                 res_cols.append('ID')
             
             res_data = df[res_cols].fillna("").to_dict(orient='records')
             os.makedirs("uploads", exist_ok=True)
             with open(f"uploads/{job_id}_resolution.json", 'w') as f:
                 json.dump(res_data, f)
        except Exception as e:
            logger.error(f"Resolution Save Failed: {e}")

    # 4. Detect Roles
    roles = detect_roles(df)
    
    # 5. Determine Intent
    strategy, anchor_type = determine_intent(roles)
    
    # 6. Generate Payload
    meta_kpis = {
        "total_rows": len(df),
        "total_items": df['ID'].nunique() if 'ID' in df.columns else len(df),
        "mean_sentiment": df['Sentiment'].mean() if 'Sentiment' in df.columns else None,
        "avg_sentiment": round(df['Sentiment'].mean(), 2) if 'Sentiment' in df.columns else None,
        "top_cluster": df['Cluster'].mode()[0] if 'Cluster' in df.columns and not df['Cluster'].empty else "N/A",
        "top_class": df['Classification'].mode()[0] if 'Classification' in df.columns and not df['Classification'].empty else "N/A",
    }
    print(f"[Analysis] Top Class Calc: Cols={'Classification' in df.columns}, Empty={df['Classification'].empty if 'Classification' in df.columns else 'True'}, Mode={df['Classification'].mode().tolist() if 'Classification' in df.columns else 'None'}")

    # 7. Always build the anchor bar chart (fixed regardless of isTimestamp)
    anchor_bar = _build_cluster_anchor(df, roles)

    # 8. Build sub-anchor block
    donut = _build_sentiment_donut(df)
    is_timestamp = roles["Time"]["valid"]

    if is_timestamp:
        # Secondary = temporal line chart
        temporal_secondary = _build_temporal_anchor(df, roles)
        secondary_type = "LINE"
        secondary = temporal_secondary
    else:
        # Secondary = treemap (title or cluster)
        secondary = _build_title_treemap(df)
        secondary_type = "TREEMAP"

    sub_anchor = None
    if donut is not None:
        sub_anchor = SubAnchorBlock(
            donut=donut,
            secondary_type=secondary_type,
            secondary=secondary
        )

    if strategy == "TEMPORAL_SUPREME":
        # Note: anchor_visual is the bar chart even in TEMPORAL_SUPREME
        print(f"[Analysis] Generated Temporal Payload. KPIs: {meta_kpis}")
        return TemporalPayload(
            meta={"kpis": meta_kpis},
            anchor_visual=anchor_bar,
            sub_anchor=sub_anchor
        )
        
    elif strategy == "SNAPSHOT_PIVOT":
        widgets = []
        
        if anchor_type == "Cluster":
            widgets.append(_build_cluster_anchor(df, roles))
        elif anchor_type == "Classification":
            widgets.append(_build_classification_anchor(df))
        elif anchor_type == "Title":
            widgets.append(_build_atom_anchor(df))
        elif anchor_type == "Histogram":
            widgets.append(_build_histogram_anchor(df))
        elif anchor_type == "KPI":
            widgets.append(_build_kpi_card(df))

        print(f"[Analysis] Generated Snapshot Payload. KPIs: {meta_kpis}")
        print(f"[Analysis] First Widget: {widgets[0] if widgets else 'None'}")
        
        return SnapshotPayload(
            meta={"kpis": meta_kpis},
            anchor_options=widgets,
            default_option_index=0,
            sub_anchor=sub_anchor
        )
        
    return UnsupportedPayload(
        layout_strategy="UNSUPPORTED_DATASET", meta=meta, reason_code="DATA_NOT_SUITABLE", missing_requirements=["Unknown Logic"]
    )
