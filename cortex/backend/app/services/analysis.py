import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import os
from app.schemas.report import (
    ReportPayload, TemporalPayload, SnapshotPayload, UnsupportedPayload,
    WidgetObject, MultiLineWidget, BarChartWidget, PieChartWidget, ComboChartWidget, ScatterWidget,
    WidgetType
)
from app.services.ingestion import load_dataset

# Constants
MIN_ROWS_FOR_TEMPORAL = 2
# NOTE: Variance threshold is heuristic and v1-specific.
# Do not reuse blindly for other metrics or normalized data.
MIN_VARIANCE_FOR_SCATTER = 0.001

# ... (Imports remain the same)

def safe_normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Attempts to map user columns to Cortex Standard Schema.
    Timestamp, Title, Cluster, Sentiment, Confidence.
    """
    # Map: User -> Standard
    normalization_map = {
        # User Specific Overrides (Priority)
        'category_cluster': 'Cluster',
        'average_polarity': 'Sentiment',
        'sentiment_class': 'SentimentClass', # Aux
        'id': 'ID',

        'timestamp': 'Timestamp', 'date': 'Timestamp', 'created_at': 'Timestamp', 'time': 'Timestamp',
        'title': 'Title', 'subject': 'Title', 'headline': 'Title', 'summary': 'Title', 'review': 'Title', 'text': 'Title', 'content': 'Title',
        'cluster': 'Cluster', 'category': 'Cluster', 'topic': 'Cluster',
        'sentiment': 'Sentiment', 'polarity': 'Sentiment', 'rating': 'Sentiment', 'score': 'Sentiment',
        'confidence': 'Confidence', 'score_confidence': 'Confidence'
    }
    
    # Create a copy to avoid mutating original if needed elsewhere (though we usually consume it here)
    df = df.copy()
    
    # 1. Lowercase all valid columns for matching
    # We want to rename 'Date' -> 'timestamp' -> 'Timestamp'
    
    current_cols = df.columns.tolist()
    rename_dict = {}
    
    used_standards = set()
    
    for col in current_cols:
        lower_col = col.lower().strip()
        if lower_col in normalization_map:
            standard = normalization_map[lower_col]
            if standard not in used_standards:
                rename_dict[col] = standard
                used_standards.add(standard)
    
    if rename_dict:
        print(f"[Analysis] Normalizing Columns: {rename_dict}")
        df.rename(columns=rename_dict, inplace=True)
    
    # 2. Value Normalization: Lowercase text columns
    # User Rule: "all texts should be lower cased while operating"
    target_cols = ['Cluster', 'SentimentClass', 'Sentiment', 'Title']
    for col in target_cols:
        if col in df.columns:
            # check if string dtype
            if pd.api.types.is_string_dtype(df[col]) or pd.api.types.is_object_dtype(df[col]):
                # 1. Fill real NaNs
                df[col] = df[col].fillna("")
                # 2. Stringify and lower
                df[col] = df[col].astype(str).str.lower().str.strip()
                # 3. Nukem string "nan" or "none"
                df[col] = df[col].replace(["nan", "none", "null"], "")
        
    return df

# ... (omitted)

    # 2. BarChart by Cluster
    if 'Cluster' in df.columns:
        # Check if values are list-like strings (e.g. "['Tag1', 'Tag2']")
        # We want to count individual tags, not unique combinations.
        import ast
        
        cluster_series = df['Cluster'].dropna()
        # Filter out empty strings
        cluster_series = cluster_series[cluster_series != ""]
        
        if not cluster_series.empty:
            first_val = cluster_series.iloc[0]
            # Heuristic: If it looks like a list string, parse and explode
            if isinstance(first_val, str) and first_val.strip().startswith('[') and first_val.strip().endswith(']'):
                try:
                    # Parse string representation of list -> actual list
                    # Use a safely wrapped apply
                    def safe_parse(x):
                        try:
                            val = ast.literal_eval(x)
                            # If individual items are strings, lowercase them too?
                            # Our normalization handled the blob string.
                            # safe_normalize might have lowercased "['Tag']" to "['tag']"
                            # which is valid python syntax for list of strings.
                            if isinstance(val, list):
                                return [str(v).lower().strip() for v in val]
                            return []
                        except:
                            return [] # Fail gracefully
                    
                    parsed_series = cluster_series.apply(safe_parse)
                    # Explode the lists into individual rows
                    exploded_series = parsed_series.explode()
                    
                    # Count values first
                    cluster_counts = exploded_series.value_counts()
                    
                    # Explicit Filter: Drop keys directly from the index
                    # This is 100% reliable for "spacy_noun" and "nan"
                    drop_keys = ['spacy_noun', 'nan', '', 'none']
                    cluster_counts = cluster_counts.drop(labels=drop_keys, errors='ignore').head(20)
                    
                except Exception as e:
                    print(f"Cluster explosion failed: {e}")
                    # Fallback
                    cluster_counts = cluster_series.value_counts()
                    cluster_counts = cluster_counts.drop(labels=['spacy_noun', 'nan', '', 'none'], errors='ignore').head(20)
            else:
                 # Normal string categories
                 cluster_counts = cluster_series.value_counts()
                 cluster_counts = cluster_counts.drop(labels=['spacy_noun', 'nan', '', 'none'], errors='ignore').head(20)

def detect_satellites(df: pd.DataFrame) -> tuple[str, List[str]]:
    """
    Decides the Layout Strategy based on the dataset shape.
    Returns: (Strategy, List[Reasons if Unsupported])
    Strategies: "TEMPORAL_SUPREME", "SNAPSHOT_PIVOT", "UNSUPPORTED_DATASET"
    """
    # Normalize First
    df = safe_normalize_columns(df)
    
    reasons = []

    # Gate 1: TEMPORAL_SUPREME
    # Check: Timestamp column exists? AND Valid Datetime Parse? AND Sufficient Rows (>1)?
    if 'Timestamp' in df.columns:
        # Attempt conversion if not already datetime
        if not pd.api.types.is_datetime64_any_dtype(df['Timestamp']):
            try:
                df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce') # Coerce is safer
            except:
                pass 

        if pd.api.types.is_datetime64_any_dtype(df['Timestamp']):
             valid_dates = df['Timestamp'].dropna()
             if len(valid_dates) >= MIN_ROWS_FOR_TEMPORAL:
                 return "TEMPORAL_SUPREME", []
             else:
                 reasons.append("Timestamp column found but insufficient valid rows (<2).")
        else:
            reasons.append("Timestamp column found but could not parse valid datetimes.")
    else:
        reasons.append("No 'Timestamp' column found (checked aliases: date, time, created_at).")
    
    # Gate 2: SNAPSHOT_PIVOT
    # Check: ANY categorical OR numeric?
    has_categorical = any(pd.api.types.is_string_dtype(df[col]) for col in df.columns)
    has_metric = any(pd.api.types.is_numeric_dtype(df[col]) for col in df.columns if col != 'Timestamp')
    
    # Relaxed Gate: If we have ANY data, we can at least show a count or list.
    if len(df) > 0:
        return "SNAPSHOT_PIVOT", []
    
    return "UNSUPPORTED_DATASET", reasons

def _build_temporal_payload(df: pd.DataFrame) -> TemporalPayload:
    # Re-run strict normalization to be sure
    df = safe_normalize_columns(df)
    
    if not pd.api.types.is_datetime64_any_dtype(df['Timestamp']):
         df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
         df = df.dropna(subset=['Timestamp'])

    # Aggregate by Day
    daily_counts = df.groupby(df['Timestamp'].dt.date).size().reset_index(name='count')
    # Sort by date
    daily_counts = daily_counts.sort_values('Timestamp')
    
    widget = MultiLineWidget(
        id="temporal_main",
        title="Event Velocity",
        aspect_ratio=2.5,
        x_axis=daily_counts['Timestamp'].astype(str).tolist(),
        series=[
            {"name": "Events", "data": daily_counts['count'].tolist()}
        ]
    )
    
    total_events = int(daily_counts['count'].sum())
    
    kpis = {
        "total_events": total_events,
        "velocity_trend": "STABLE", # MVP Placeholder
        "top_metric_label": "Total Events",
        "top_metric_value": total_events
    }

    return TemporalPayload(
        meta={"source": "AnalysisService", "kpis": kpis},
        anchor_visual=widget
    )

def _build_snapshot_payload(df: pd.DataFrame) -> SnapshotPayload:
    df = safe_normalize_columns(df)
    
    widgets: List[WidgetObject] = []
    
    # --- PRE-CALCULATE & FILTER DATA ---
    
    # 1. Sentiment Counts
    sentiment_counts = pd.Series(dtype=int)
    if 'SentimentClass' in df.columns:
        sentiment_counts = df['SentimentClass'].value_counts()
        sentiment_counts = sentiment_counts.drop(labels=['nan', '', 'none', 'n/a'], errors='ignore')
        
    # 2. Cluster Counts (Exploded)
    cluster_counts = pd.Series(dtype=int)
    if 'Cluster' in df.columns:
        import ast
        cluster_series = df['Cluster'].dropna()
        cluster_series = cluster_series[cluster_series != ""]
        if not cluster_series.empty:
            def safe_parse(x):
                try:
                    val = ast.literal_eval(x)
                    if isinstance(val, list):
                        return [str(v).lower().strip() for v in val]
                    return []
                except:
                    # Treat as simple string if not list-like
                    return [str(x).lower().strip()]
            
            # Apply parse strings -> lists
            # Optimization: logic check first item to decide parsing strategy
            first_val = cluster_series.iloc[0] 
            if isinstance(first_val, str) and first_val.strip().startswith('['):
                 parsed = cluster_series.apply(safe_parse)
                 exploded = parsed.explode()
            else:
                 exploded = cluster_series
            
            cluster_counts = exploded.value_counts()
            # STRICT FILTER
            drop_keys = ['spacy_noun', 'nan', '', 'none', 'n/a']
            cluster_counts = cluster_counts.drop(labels=drop_keys, errors='ignore')

    # --- WIDGET GENERATION ---
    
    # 1. Main Anchor Widget
    # Priority: Sentiment Donut (if requested/available) -> Title -> Other String
    # User specifically wanted Donut for Sentiment logic previously.
    # Let's check what we should show.
    
    # If SentimentClass exists, we usually prefer that for the Donut slot or Title slot?
    # Original logic: "if not title_col and 'SentimentClass'..." implies fallback.
    # Let's stick to: If 'SentimentClass' exists, show Donut. 
    # BUT user might want Title frequency too.
    # The requirement seems to be: Show "Sentiment Distribution" as Chart 1 if possible.
    
    if not sentiment_counts.empty:
         widgets.append(PieChartWidget(
            id="snapshot_sentiment_donut",
            title="Sentiment Distribution",
            aspect_ratio=1.0,
            categories=sentiment_counts.head(10).index.tolist(),
            series=[{"name": "Count", "data": sentiment_counts.head(10).values.tolist()}]
         ))
    elif 'Title' in df.columns:
        # Fallback to Title Combo
        t_counts = df['Title'].value_counts().drop(['nan',''], errors='ignore').head(10)
        widgets.append(ComboChartWidget(
            id="snapshot_title",
            title="Top Titles",
            aspect_ratio=1.5,
            x_axis=t_counts.index.tolist(),
            bar_series=[{"name": "Count", "data": t_counts.values.tolist()}],
            line_series=[]
        ))

    # 2. Cluster Bar Chart
    if not cluster_counts.empty:
        top_20_clusters = cluster_counts.head(20)
        widgets.append(BarChartWidget(
            id="snapshot_cluster",
            title="Cluster Distribution",
            aspect_ratio=1.5,
            categories=top_20_clusters.index.tolist(),
            series=[{"name": "Count", "data": top_20_clusters.values.tolist()}]
        ))

    # Fallback if empty
    if not widgets:
         widgets.append(BarChartWidget(
             id="snapshot_fallback",
             title="Total Items",
             aspect_ratio=1.5,
             categories=["Total"],
             series=[{"name": "Count", "data": [len(df)]}]
         ))

    # --- KPI CALCULATION (Reuse Data) ---
    
    total_rows = len(df)
    
    # Top Cluster
    top_cluster_val = "N/A"
    if not cluster_counts.empty:
        top_cluster_val = cluster_counts.index[0] # Guaranteed consistent with chart
        
    # Top Class
    top_class_val = "N/A"
    if not sentiment_counts.empty:
        top_class_val = sentiment_counts.index[0] # Guaranteed consistent with Donut

    # Avg Sentiment
    avg_sentiment = None
    if 'Sentiment' in df.columns:
         try:
            sent_numeric = pd.to_numeric(df['Sentiment'], errors='coerce')
            avg_sentiment = float(sent_numeric.mean())
         except:
             pass

    kpis = {
        "total_items": total_rows,
        "top_cluster": top_cluster_val,
        "top_class": top_class_val,
        "avg_sentiment": round(avg_sentiment, 2) if avg_sentiment is not None else "N/A"
    }

    return SnapshotPayload(
        meta={"source": "AnalysisService", "kpis": kpis},
        anchor_options=widgets
    )

def generate_report_payload(file_ids: List[str], job_id: str = None) -> ReportPayload:
    """
    Orchestrates ingestion, detection, and manufacturing.
    Optionally saves resolution data if job_id is provided.
    """
    # For MVP, we merge all files into one DF?
    # The workflow implies "List of file IDs" -> Report.
    # We should probably load all and concat.
    
    # ... imports needed inside function ...
    from app.api.endpoints.ingestion import upload_sessions
    import json
    
    dfs = []
    processed_files = 0
    
    for fid in file_ids:
        if fid in upload_sessions:
            fpath = upload_sessions[fid].get('file_path')
            if fpath and os.path.exists(fpath):
                try:
                    df = load_dataset(fpath)
                    dfs.append(df)
                    processed_files += 1
                except Exception as e:
                    print(f"Error loading {fid}: {e}")
    
    if not dfs:
        raise ValueError("No valid data found.")
        
    full_df = pd.concat(dfs, ignore_index=True)
    
    # Normalize First (Crucial for Resolution Data too)
    full_df = safe_normalize_columns(full_df)

    # SAVE RESOLUTION DATA (Bridge to ResolutionService)
    if job_id:
        try:
            # Select relevant columns for Resolution Workspace
            # ID, Title, Cluster, Sentiment, Confidence
            # Ensure they exist (normalization handles most, but check existence)
            res_cols = ['ID', 'Title', 'Cluster', 'Sentiment', 'Confidence']
            available_cols = [c for c in res_cols if c in full_df.columns]
            
            # If ID missing, generate UUIDs? No, keep index or something?
            # Ideally we want stable IDs. If user provided ID, use it.
            if 'ID' not in full_df.columns:
                full_df['ID'] = [str(uuid.uuid4()) for _ in range(len(full_df))]
                available_cols.append('ID')
            
            res_df = full_df[available_cols].copy()
            
            # Fill NaNs
            res_df = res_df.fillna("N/A")
            
            # Convert to dict list
            res_data = res_df.to_dict(orient='records')
            
            # Save to uploads/{job_id}_resolution.json
            upload_dir = os.path.join(os.getcwd(), "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            res_path = os.path.join(upload_dir, f"{job_id}_resolution.json")
            
            with open(res_path, 'w') as f:
                json.dump(res_data, f)
            print(f"[Analysis] Saved {len(res_data)} items for Resolution to {res_path}")
            
        except Exception as e:
            print(f"[Analysis] Failed to save resolution data: {e}")

    # Detect Strategy handles normalization internally (redundant but safe)
    strategy, reasons = detect_satellites(full_df)
    
    if strategy == "TEMPORAL_SUPREME":
        return _build_temporal_payload(full_df)
    elif strategy == "SNAPSHOT_PIVOT":
        return _build_snapshot_payload(full_df)
    else:
        return UnsupportedPayload(
            meta={"source": "AnalysisService", "status": "rejected"},
            reason_code="DATA_NOT_SUITABLE",
            missing_requirements=reasons
        )

