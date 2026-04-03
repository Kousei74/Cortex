from fastapi import HTTPException
from supabase import Client
from typing import Optional, Dict, Any, List

class TreeLogicService:
    @staticmethod
    def _parent_ref(node: Dict[str, Any]) -> Optional[str]:
        return node.get("parent_node_id") or node.get("root_issue_id")

    @staticmethod
    def _collect_ancestors(start_id: str, node_map: Dict[str, Dict[str, Any]], root_issue_id: str) -> set[str]:
        ancestors = set()
        current_id = start_id

        while current_id:
            ancestors.add(current_id)
            if current_id == root_issue_id:
                break

            current_node = node_map.get(current_id)
            if not current_node:
                break

            current_id = TreeLogicService._parent_ref(current_node)

        return ancestors

    @staticmethod
    def _find_common_blue_ancestor(node_id_1: str, node_id_2: str, node_map: Dict[str, Dict[str, Any]], root_issue_id: str) -> Optional[Dict[str, Any]]:
        target_ancestors = TreeLogicService._collect_ancestors(node_id_2, node_map, root_issue_id)
        trail: List[str] = []
        encountered_blue_before_match = False
        current_id = node_id_1

        while current_id:
            current_node = node_map.get(current_id)
            if current_node and current_node.get("tag") == "blue":
                if current_id in target_ancestors:
                    return {
                        "gatekeeper_id": current_id,
                        "trail": trail,
                        "has_unmerged_sub_branches": encountered_blue_before_match,
                    }
                encountered_blue_before_match = True

            if current_id == root_issue_id:
                break

            if not current_node:
                break

            trail.append(current_id)
            current_id = TreeLogicService._parent_ref(current_node)

        return None

    @staticmethod
    def _is_descendant(candidate_id: str, ancestor_id: str, children_map: Dict[str, List[str]]) -> bool:
        queue = list(children_map.get(ancestor_id, []))
        seen = set()

        while queue:
            current_id = queue.pop(0)
            if current_id in seen:
                continue
            if current_id == candidate_id:
                return True
            seen.add(current_id)
            queue.extend(children_map.get(current_id, []))

        return False

    @staticmethod
    def validate_node_creation(supabase: Client, parent_id: str, connection_type: str) -> None:
        """
        Terminal Enforcement: Child cannot be added if parent is 'pending' or 'yellow'.
        The Blue Lock: If parent is 'blue', the first child must be LEFT or RIGHT. If creating MAIN, there must already be a tagged LEFT/RIGHT child.
        Slot Management: Max 2 side branches (LEFT, RIGHT).
        """
        res = supabase.table("issue_nodes").select("tag, connection_type").eq("id", parent_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Parent node {parent_id} not found.")
        parent = res.data[0]
        p_tag = parent.get("tag")
        
        if p_tag in ["pending", "yellow"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Terminal Enforcement: Cannot add children to provisional nodes (tag: {p_tag}). Promote the node to Green, Blue, or Red first."
            )

        children_res = supabase.table("issue_nodes").select("tag, connection_type").eq("parent_node_id", parent_id).execute()
        children = children_res.data or []

        if connection_type in ["LEFT", "RIGHT"]:
            slots_used = [c.get("connection_type") for c in children if c.get("connection_type") == connection_type]
            if slots_used:
                raise HTTPException(status_code=400, detail=f"Slot Management: Parent already has a {connection_type} child branch.")

        if p_tag == "blue" and connection_type == "MAIN":
            side_children = [c for c in children if c.get("connection_type") in ["LEFT", "RIGHT"]]
            has_tagged_side = any(c.get("tag") in ["green", "blue", "red"] for c in side_children)
            if not has_tagged_side:
                raise HTTPException(
                    status_code=400, 
                    detail="The Blue Lock: A Blue gatekeeper node requires at least one tagged side-branch (LEFT/RIGHT) before progressing the MAIN path."
                )

    @staticmethod
    def cleanup_yellow_siblings(supabase: Client, parent_id: Optional[str], root_id: str, connection_type: str) -> None:
        """
        If a Yellow node is promoted to Green or Blue, delete all other Yellow siblings with the EXACT SAME connection_type.
        """
        del_query = supabase.table("issue_nodes").delete().eq("root_issue_id", root_id).eq("tag", "yellow").eq("connection_type", connection_type)
        if parent_id:
            del_query = del_query.eq("parent_node_id", parent_id)
        else:
            del_query = del_query.is_("parent_node_id", "null")
            
        del_query.execute()

    @staticmethod
    def _is_side_branch(supabase: Client, node_id: str) -> bool:
        """Backtracks to find if the node is within a side-branch (descends from LEFT or RIGHT)."""
        current_id = node_id
        while current_id:
            res = supabase.table("issue_nodes").select("parent_node_id, connection_type").eq("id", current_id).execute()
            if not res.data:
                break
            n = res.data[0]
            if n.get("connection_type") in ["LEFT", "RIGHT"]:
                return True
            current_id = n.get("parent_node_id")
        return False

    @staticmethod
    def execute_red_axe(supabase: Client, node_id: str) -> dict:
        """
        If the Red node is on the main tree path, it acts as an End Node (Immutable).
        If inside a side-branch, it truncates the sub-tree from that branch down.
        """
        is_side = TreeLogicService._is_side_branch(supabase, node_id)
        if not is_side:
            res = supabase.table("issue_nodes").select("root_issue_id").eq("id", node_id).execute()
            if res.data:
                root_id = res.data[0]["root_issue_id"]
                supabase.table("issues").update({"status": "closed"}).eq("id", root_id).execute()
            return {"action": "closed_issue", "message": "Red Node on Main Path: Issue closed and locked as immutable."}
        else:
            res = supabase.table("issue_nodes").select("root_issue_id").eq("id", node_id).execute()
            if not res.data:
                return {"action": "none"}
            root_id = res.data[0]["root_issue_id"]
            
            all_nodes_res = supabase.table("issue_nodes").select("id, parent_node_id").eq("root_issue_id", root_id).execute()
            all_nodes = all_nodes_res.data
            
            adj = {}
            for n in all_nodes:
                p = n.get("parent_node_id")
                if p not in adj: adj[p] = []
                adj[p].append(n["id"])
                
            to_delete = []
            queue = [node_id]
            while queue:
                curr = queue.pop(0)
                to_delete.append(curr)
                queue.extend(adj.get(curr, []))
                
            if to_delete:
                supabase.table("issue_nodes").delete().in_("id", to_delete).execute()
                
            return {"action": "truncated", "message": f"Red Axe triggered: Truncated {len(to_delete)} branch nodes."}

    @staticmethod
    def resolve_blue_parent_via_backtrack(supabase: Client, tail_node_id: str) -> Optional[str]:
        """
        Crawls up the branch. As long as connection_type == MAIN, keep going up. 
        When LEFT or RIGHT is hit, the parent of THAT connection is the Blue Parent.
        """
        current_id = tail_node_id
        while current_id:
            res = supabase.table("issue_nodes").select("parent_node_id, connection_type").eq("id", current_id).execute()
            if not res.data:
                break
            n = res.data[0]
            if n.get("connection_type") in ["LEFT", "RIGHT"]:
                return n.get("parent_node_id")
            current_id = n.get("parent_node_id")
        return None

    @staticmethod
    def verify_branch_resolved(supabase: Client, blue_parent_id: str, merge_side: str) -> None:
        """
        Validates that the specific side branch (LEFT or RIGHT) originating from the Blue Parent contains NO unresolved 'blue' nodes.
        """
        res = supabase.table("issue_nodes").select("id, root_issue_id").eq("parent_node_id", blue_parent_id).eq("connection_type", merge_side).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail=f"No {merge_side} branch found for this parent.")
            
        side_root = res.data[0]
        root_issue_id = side_root["root_issue_id"]
        
        all_nodes_res = supabase.table("issue_nodes").select("id, parent_node_id, tag").eq("root_issue_id", root_issue_id).execute()
        all_nodes = all_nodes_res.data
        
        adj = {}
        node_map = {}
        for n in all_nodes:
            p = n.get("parent_node_id")
            if p not in adj: adj[p] = []
            adj[p].append(n["id"])
            node_map[n["id"]] = n
            
        queue = [side_root["id"]]
        while queue:
            curr = queue.pop(0)
            node_data = node_map.get(curr)
            if node_data and node_data.get("tag") == "blue":
                raise HTTPException(status_code=400, detail="Merge blocked: Branch contains unresolved Blue nodes.")
            queue.extend(adj.get(curr, []))

    @staticmethod
    def validate_node_connection(supabase: Client, source_node_id: str, target_id: str) -> None:
        source_res = supabase.table("issue_nodes").select("id, root_issue_id, connected_to_id").eq("id", source_node_id).execute()
        if not source_res.data:
            raise HTTPException(status_code=404, detail="Source node not found.")

        source_node = source_res.data[0]
        root_issue_id = source_node["root_issue_id"]

        root_res = supabase.table("issues").select("id, status").eq("id", root_issue_id).execute()
        if not root_res.data:
            raise HTTPException(status_code=404, detail="Root issue not found.")
        if root_res.data[0].get("status") == "closed":
            raise HTTPException(status_code=400, detail="Cannot connect nodes inside a closed issue.")

        if source_node_id == target_id:
            raise HTTPException(status_code=400, detail="A node cannot connect to itself.")

        existing_target = source_node.get("connected_to_id")
        if existing_target:
            if existing_target == target_id:
                raise HTTPException(status_code=400, detail="Node is already connected to this target.")
            raise HTTPException(status_code=400, detail="Node already has a merge connection. Remove it before reconnecting.")

        all_nodes_res = supabase.table("issue_nodes").select(
            "id, parent_node_id, root_issue_id, tag"
        ).eq("root_issue_id", root_issue_id).execute()
        all_nodes = all_nodes_res.data or []
        node_map = {node["id"]: node for node in all_nodes}

        if target_id != root_issue_id and target_id not in node_map:
            raise HTTPException(status_code=404, detail="Connection target not found.")

        children_map: Dict[str, List[str]] = {}
        for node in all_nodes:
            parent_id = node.get("parent_node_id") or root_issue_id
            children_map.setdefault(parent_id, []).append(node["id"])

        if TreeLogicService._is_descendant(target_id, source_node_id, children_map):
            raise HTTPException(status_code=400, detail="Cannot connect a node to one of its descendants.")

        active_trace = (
            TreeLogicService._find_common_blue_ancestor(source_node_id, target_id, node_map, root_issue_id)
            or TreeLogicService._find_common_blue_ancestor(target_id, source_node_id, node_map, root_issue_id)
        )

        if active_trace and active_trace["has_unmerged_sub_branches"]:
            raise HTTPException(
                status_code=400,
                detail="Merge blocked: This branch contains unresolved nested blue nodes. Resolve the nested branches before connecting.",
            )
