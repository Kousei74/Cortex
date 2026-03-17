# Map Feature Logic Implementation Plan (Story 4.x)

This document outlines the spotless, phased implementation roadmap for the Issue Resolution Tree's branching, merging, and stacking logic.

## Logic Pillars: The Hierarchy of Truth
- **Immutability**: Once a node is tagged Green/Blue/Red, it is final. Only Pending nodes (within 30m) can be deleted.
- **Gatekeeping**: Blue parents block "Main Branch" progress until side-branch validation occurs.
- **Unforgiving Truncation (The Axe)**: Red tags on side-branches trigger recursive deletion of the affected sub-tree.
- **Recursive Merge**: Branches must be fully resolved (no Blue nodes) before merging back to the parent.
- **Persistence**: Merged branches remain as a permanent historical audit trail.

---

## Phase 1: Foundation (OCC & Terminal Stacking)
*Goal: Secure the state machine and implement basic cleanup.*

1. **Optimistic Concurrency Control (OCC)**:
   - Enforce `updated_at` checks in `tag_issue_node`, `update_issue_node_info`, and `delete_issue_node`.
   - Any mutation must match the client-provided `last_updated_at` or return a `409 Conflict`.

2. **Yellow Stacking & Promotion**:
   - Update `tag_issue_node` logic: When a node is promoted to **Green** or **Blue**, all skip-logic siblings (**Yellow**) under the same `parent_node_id` must be deleted.

3. **Terminal Enforcement**:
   - Update `create_child_issue`: Restrict child node creation. Children can ONLY be added to tagged nodes (**Green, Blue, Red**).
   - Attempting to add a child to a **Pending** or **Yellow** node must return a `400 Bad Request`.

---

## Phase 2: Structural Integrity (Branch Gating)
*Goal: Enforce the "Gatekeeper" rules and 2-branch limits.*

1. **Logical Connection Addressing**:
   - The system distinguishes paths using explicit `connection_type` metadata:
     - **Main Path**: `connection_type == 'MAIN'`
     - **Side Branch**: `connection_type == 'SIDE_LEFT'` or `'SIDE_RIGHT'`
   - Hierarchy is resolved via **Backtracking Algorithms** (crawling up `parent_node_id` links).

2. **Branch Slot Management**:
   - Enforce **Max 2 branches** (one Left, one Right) per node.
   - Truncation of a branch (Red Axe) immediately frees the associated slot.

3. **The Blue Lock (Gatekeeper)**:
   - In `create_child_issue`, if a parent is **Blue**, block the creation of a **Main Path** child until the side-branch has at least one child with a valid tag (Green/Blue/Red).

---

## Phase 3: The Red Axe (Recursive Truncation)
*Goal: Isolate and remove failed paths without affecting the main tree.*

1. **Axe Trigger**:
   - Update `tag_issue_node`: If a node on a **side-branch** is tagged **Red**, trigger a recursive deletion of its entire sub-tree.
   - The "Side Branch" status is determined dynamically by backtracking to a node with a `SIDE_...` connection type.
   
2. **Persistence Guarantee**:
   - The original **Blue Parent** remains intact (remains Blue), allowing the team to start a fresh branch on that side.
   - The **Main Branch** remains unaffected.

---

## Phase 4: Recursive staircase Merge
*Goal: Validate the trail and finalize the truth path.*

1. **Recursive Resolve Check**:
   - In `merge_blue_branch`, before allowing a merge, the system must traverse the branch downwards using a recursive or backtracking search.
   - If any **Blue** nodes (unresolved sub-branches) are found, the merge is blocked: *"Merge unsuccessful: unresolved children present"*.

2. **Documentation & Truth Shift**:
   - Merging triggers the **Edit Node** modal for the Blue Parent.
   - Upon save, the Blue Parent turns **Green**.
   - **Persistence**: Branch nodes are **NOT** deleted; they remain as a permanent record of the work trail.

3. **Security Constraints**:
   - Block cross-branch connections (e.g., Left-branch to Right-branch direct linking).

---

## Phase 5: Verification & Safety
*Goal: Prove the hierarchy is mathematically sound.*

1. **Automated Suite**: `tests/verify_map_hierarchy.py`
   - Test 1: Yellow cleanup upon promotion.
   - Test 2: Blue parent locking/unlocking main path.
   - Test 3: Red tag isolates deletion to sub-tree only.
   - Test 4: Recursive merge blocking for unresolved children.
   - Test 5: OCC conflict handling.

2. **Audit Check**:
   - Verify that root-issue nodes are strictly immutable and cannot be tagged/deleted.
