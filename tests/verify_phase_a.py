import sys
import os
import pandas as pd
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'cortex', 'backend'))

from app.services.analysis import generate_report_payload, detect_satellites
from app.api.endpoints import ingestion

# Setup dummy data
def run_verification():
    print("--- Starting Phase A Verification ---")
    
    # Ensure uploads dir exists
    os.makedirs('cortex/backend/uploads', exist_ok=True)
    
    # 1. Create Temporal CSV
    temporal_df = pd.DataFrame({
        'Timestamp': pd.to_datetime(['2023-01-01', '2023-01-02', '2023-01-03']),
        'Event': ['A', 'B', 'C']
    })
    temporal_path = os.path.abspath('cortex/backend/uploads/test_temporal.csv')
    temporal_df.to_csv(temporal_path, index=False)
    
    # 2. Create Snapshot CSV
    snapshot_df = pd.DataFrame({
        'ID': ['1', '2', '3'],
        'Title': ['Issue A', 'Issue B', 'Issue A'],
        'Cluster': ['C1', 'C2', 'C1'],
        'Confidence': [0.9, 0.8, 0.95],
        'Sentiment': [0.1, 0.5, 0.2] # Variance exists
    })
    snapshot_path = os.path.abspath('cortex/backend/uploads/test_snapshot.csv')
    snapshot_df.to_csv(snapshot_path, index=False)
    
    # 3. Create Unsupported CSV
    unsupported_df = pd.DataFrame({
        'Random': [1, 2, 3] # No Time, No Cat+Metric combo (Random is numeric, but no Cat)
    })
    unsupported_path = os.path.abspath('cortex/backend/uploads/test_unsupported.csv')
    unsupported_df.to_csv(unsupported_path, index=False)
    
    # Mock Sessions
    ingestion.upload_sessions = {
        "id_temporal": {"file_path": temporal_path, "filename": "test_temporal.csv"},
        "id_snapshot": {"file_path": snapshot_path, "filename": "test_snapshot.csv"},
        "id_unsupported": {"file_path": unsupported_path, "filename": "test_unsupported.csv"}
    }
    
    # Test 1: Temporal
    print("\nTest 1: Temporal Data")
    try:
        payload = generate_report_payload(["id_temporal"])
        print(f"Result Strategy: {payload.layout_strategy}")
        assert payload.layout_strategy == "TEMPORAL_SUPREME"
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    # Test 2: Snapshot
    print("\nTest 2: Snapshot Data")
    try:
        payload = generate_report_payload(["id_snapshot"])
        print(f"Result Strategy: {payload.layout_strategy}")
        assert payload.layout_strategy == "SNAPSHOT_PIVOT"
        # Check Scatter
        options = payload.anchor_options
        has_scatter = any(w.type == "SCATTER_PLOT" for w in options)
        print(f"Has Scatter: {has_scatter}")
        assert has_scatter
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    # Test 3: Unsupported
    print("\nTest 3: Unsupported Data")
    try:
        payload = generate_report_payload(["id_unsupported"])
        print(f"Result Strategy: {payload.layout_strategy}")
        assert payload.layout_strategy == "UNSUPPORTED_DATASET"
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

if __name__ == "__main__":
    run_verification()
