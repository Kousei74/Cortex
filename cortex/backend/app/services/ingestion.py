import os
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional

# 100MB Limit
MAX_FILE_SIZE_MB = 100
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

def load_dataset(file_path: str) -> pd.DataFrame:
    """
    Loads a dataset from the given path into a Pandas DataFrame.
    
    Guardrails:
    1. File Size < 100MB
    2. Supported Formats: CSV, JSON, Parquet
    3. Memory Optimization: specific types
    4. Sanitization: NaN/Inf -> None
    """
    
    # --- Guardrail 1: File Size ---
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File is too large ({file_size / 1024 / 1024:.2f} MB). "
            f"Maximum allowed size is {MAX_FILE_SIZE_MB} MB."
        )

    # --- Loading Logic ---
    ext = Path(file_path).suffix.lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(file_path, low_memory=False)
        elif ext == '.json':
            df = pd.read_json(file_path)
        elif ext == '.parquet':
            df = pd.read_parquet(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {ext}")
    except Exception as e:
        raise ValueError(f"Failed to parse file: {str(e)}")

    # --- Guardrail 2: Memory Optimization (Category Types) ---
    # Disabled for V1 to prevent silent semantic semantic mutations in groupby
    # per Risk Assessment. Will revisit if memory becomes a bottleneck.
    # for col in df.select_dtypes(include=['object']).columns:
    #     num_unique = df[col].nunique()
    #     num_total = len(df)
    #     if num_total > 0 and (num_unique / num_total) < 0.5: # Example threshold: 50% unique
    #          df[col] = df[col].astype('category')

    # --- Sanitization: NaN/Inf -> None ---
    # Replace infinite values with NaN
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    
    # Replace specific string "NaN" or "Infinity" variants if necessary (pandas handles most)
    
    # Replace NaN with None (JSON safe)
    # Note: efficient way for whole DF
    df = df.where(pd.notnull(df), None)

    return df
