from app.schemas.resolution import ResolutionContext, ResolutionAction
from typing import Dict, List, Any
import uuid
import random

# In-Memory Stub Store
# job_id -> { "total": 100, "resolved": {item_id}, "ignored": {item_id} }
resolution_store = {}

class ResolutionService:
    @staticmethod
    def _get_store(job_id: str):
        if job_id not in resolution_store:
            # Try to load real data from uploads/{job_id}_resolution.json
            import os
            import json
            
            upload_dir = os.path.join(os.getcwd(), "uploads")
            res_path = os.path.join(upload_dir, f"{job_id}_resolution.json")
            
            rows = []
            if os.path.exists(res_path):
                try:
                    with open(res_path, 'r') as f:
                        rows = json.load(f)
                    print(f"[ResolutionService] Loaded {len(rows)} items from {res_path}")
                except Exception as e:
                    print(f"[ResolutionService] Failed to load real data: {e}")
                    rows = ResolutionService._generate_mock_rows(100)
            else:
                print(f"[ResolutionService] No data found for {job_id}, using mock.")
                rows = ResolutionService._generate_mock_rows(100)
                
            # Normalize Rows to lower case keys just in case? 
            # Analysis saves valid keys (Title, Cluster, etc).
            # But frontend expects lowercase keys in some places?
            # Frontend uses: title, cluster, sentiment, confidence, id.
            # Analysis saves: Title, Cluster, Sentiment, Confidence, ID.
            # We should normalize keys to lowercase for frontend compatibility.
            normalized_rows = []
            for r in rows:
                normalized_rows.append({k.lower(): v for k, v in r.items()})

            resolution_store[job_id] = {
                "total": len(normalized_rows),
                "resolved": set(),
                "ignored": set(),
                "mock_rows": normalized_rows # Renaming internal key might be better but 'mock_rows' works
            }
        return resolution_store[job_id]
        
    @staticmethod
    def _generate_mock_rows(count: int) -> List[Dict]:
        rows = []
        clusters = ["Payment Failure", "Login Issue", "UI Glitch", "Feature Request"]
        for i in range(count):
            rows.append({
                "id": str(uuid.uuid4()),
                "title": f"Issue #{i+1}: {random.choice(['Error 500', 'Crash', 'Slow Load'])}",
                "cluster": random.choice(clusters),
                "sentiment": random.uniform(-1, 1),
                "confidence": random.uniform(0.7, 0.99)
            })
        return rows

    @staticmethod
    def get_context(job_id: str) -> ResolutionContext:
        store = ResolutionService._get_store(job_id)
        total = store["total"]
        resolved = len(store["resolved"])
        ignored = len(store["ignored"])
        
        # Build Cluster Map
        # For V1 Mock, we iterate mock rows to get IDs for 'all' and specific clusters
        # In real app, this is a GroupBy query
        mock_rows = store["mock_rows"]
        clusters_map = {"all": []}
        
        for row in mock_rows:
            rid = row["id"]
            if rid not in store["resolved"] and rid not in store["ignored"]:
                # Only include UNRESOLVED items in the action map?
                # Usually "Resolve All" implies resolving remaining.
                clusters_map["all"].append(rid)
                
                c_name = row["cluster"]
                if c_name not in clusters_map:
                    clusters_map[c_name] = []
                clusters_map[c_name].append(rid)

        return ResolutionContext(
            items_total=total,
            items_resolved=resolved,
            items_remaining=total - resolved - ignored,
            clusters=clusters_map
        )

    @staticmethod
    def apply_bulk_action(job_id: str, item_ids: List[str], action: ResolutionAction) -> ResolutionContext:
        store = ResolutionService._get_store(job_id)
        
        for item_id in item_ids:
            if action == ResolutionAction.RESOLVE:
                store["resolved"].add(item_id)
                if item_id in store["ignored"]: store["ignored"].remove(item_id)
            elif action == ResolutionAction.IGNORE:
                store["ignored"].add(item_id)
                if item_id in store["resolved"]: store["resolved"].remove(item_id)
                
        return ResolutionService.get_context(job_id)

    @staticmethod
    def get_cluster_rows(job_id: str, cluster_id: str = None) -> List[Dict]:
        """
        Returns raw rows for the Diverging View.
        For V1, returns ALL rows if cluster_id is None, or filtered list.
        Also attaches 'status' (RESOLVED/UNRESOLVED) to each row.
        """
        store = ResolutionService._get_store(job_id)
        rows = store["mock_rows"]
        
        # Filter by Cluster
        if cluster_id and cluster_id.lower() != 'all':
             rows = [r for r in rows if r["cluster"] == cluster_id]
             
        # Attach Status
        enriched_rows = []
        for r in rows:
            status = "UNRESOLVED"
            if r["id"] in store["resolved"]: status = "RESOLVED"
            elif r["id"] in store["ignored"]: status = "IGNORED"
            
            enrich = r.copy()
            enrich["status"] = status
            enriched_rows.append(enrich)

        # Debug Trace
        resolved_count = sum(1 for r in enriched_rows if r["status"] == "RESOLVED")
        print(f"[ResolutionService] Returning {len(enriched_rows)} rows. Resolved: {resolved_count}")
            
        return enriched_rows
