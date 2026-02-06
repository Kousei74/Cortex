from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum

class ResolutionAction(str, Enum):
    RESOLVE = "RESOLVE"
    IGNORE = "IGNORE"

class ResolutionContext(BaseModel):
    items_total: int = 0
    items_resolved: int = 0
    items_remaining: int = 0
    clusters: Dict[str, List[str]] = {}
