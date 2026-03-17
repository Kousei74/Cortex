---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments: ['Overview.txt', 'architecture.md', 'project-context.md']
---

# Cortex - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Cortex, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: **Drag and Drop Upload**: User drags files; drop zone expands magnetically. Invalid files shake.
FR2: **Ghost Card**: Immediate visual feedback on drop (Temporary ID, interactable status).
FR3: **Zeno's Progress Bar**: Asymptotic progress bar that never stalls (stops at 90% until confirmed).
FR4: **Invisible Retry on Upload**: Automatically retry 5xx errors with exponential backoff; UI shows "Optimizing Upload Route".
FR5: **Optimistic Actions**: Allow actions (tagging, renaming) on processing items; queue locally and replay.
FR6: **Smart Dashboard Layouts**: Self-healing layouts (LayoutGroup) that slide to fill gaps if a component fails.
FR7: **Skeleton Loading**: Placeholders match exact content height to prevent CLS.
FR8: **Seamless Navigation**: View Transitions for content pane; Header/Sidebar remain fixed. Link prefetching on hover.
FR9: **Data Visualization Adaptation**: "Smart Scrapping" adapts visualization based on available data (e.g., Time Series -> Bar if timestamp missing).
FR10: **Canvas Fallback**: Switch from SVG (Recharts) to Canvas (VisX) for >10k data points.
FR11: **Headless Ingestion**: Separate metadata (`POST /ingest/meta`) from binary upload (`PUT /ingest/blob/{id}`).
FR12: **OCR Integration**: Fallback to Tesseract for image-only PDFs.
FR13: **Single Instance Enforcement**: Prevent concurrent write access by locking secondary tabs using `BroadcastChannel`.
FR14: **Quota Management**: Warn user if LocalStorage/IndexedDB is full.

### NonFunctional Requirements

NFR1: **Performance - Latency**: Any action >300ms must have a specialized mask/animation.
NFR2: **Performance - Frame Rate**: Maintain 60 FPS minimum.
NFR3: **Reliability - Offline Mode**: Switch to Read-Only `IndexedDB` mode if connection lost ("Dead Man's Switch").
NFR4: **Reliability - Queue**: "Zombie Killer" resets visibility for jobs hanging >30s.
NFR5: **Security**: Google OAuth via Supabase; RLS scoped to User ID.
NFR6: **Arch - Tech Stack**: React/Vite (Frontend), FastAPI/Python (Backend), Supabase (DB/Storage).
NFR7: **UX Philosophy**: "Seamlessness Over Everything Else".

### Additional Requirements

- **Architecture Template**: Use Monorepo structure defined in `architecture.md`.
- **Infrastructure**: Vercel (Frontend), Railway/Fly.io (Backend).
- **Edge Caching**: Cache static dashboards for 60s.
- **Data Pruning**: Delete raw blobs after 24h.
- **Image Opt**: Convert PNG to AVIF on client before upload.
- **Flight Mode Handling**: Listen to `offline`/`online` events; auto-reconnect.
- **Huge PDF Handling**: Chunked parsing for large text payloads; stream summary first.
- **Process Politeness**: "Poke" backend if job processing > 2 mins.

### FR Coverage Map

FR1: Story 2.1
FR2: Story 2.1
FR3: Story 2.2
FR4: Story 2.5
FR5: Story 2.1
FR6: Story 3.4
FR7: Story 3.1
FR8: Story 1.3
FR9: Story 3.4
FR10: Story 3.4
FR11: Story 2.4
FR12: Story 2.4
FR13: Story 2.3
FR14: Story 1.6

## Epic List

### Epic 1: Foundation & "One-Click" Access
**Goal**: Establish the "Illusionist" shell where users can securely authenticate, navigate via fluid transitions (60FPS), and trust the app (Offline Mode support), verifying the specific "Locally Optimistic" framework.
**FRs covered:** FR8, FR14. **NFRs**: NFR1, NFR2, NFR3, NFR5, NFR6, NFR7.
**Includes**: Auth (Supabase), Router (ViewTransitions), Layout Shell, **State Persistence Engine** (Zustand Rehydration), Offline handling, **Global Storage Quota** (StorageManager API).

### Epic 2: Staging & Batch Ingestion
**Goal**: Users manage a local **Persistent** "Staging Area" (Drag-drop, Ghost Cards) where they can add/remove files *before* committing. The "Batch Upload" triggers the Zeno Bar with robust retry logic (Toast prompts) for network failures. **"Reset Batch"** triggers a floating confirmation message and syncs the reset across tabs.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR11, FR12, FR13. **NFRs**: NFR4.
**Includes**: Staging State (Mutable **& Persisted**), Batch Upload Trigger, Headless Ingestion, Zeno Bar (Upload), Error Toasts (Retry Batch), Tesseract fallback, **Floating Reset Confirmation**, **Reset Sync (BroadcastChannel)**.

### Epic 3: Session-Based Dashboard & Smart Reporting
**Goal**: STRICT CHILD of Epic 2. After successful batch upload, users trigger "Generate Report" to view the dashboard (Floating Load Bar). The dashboard is **Network Independent** (Cached via IndexedDB) and persists across page refreshes. If generation takes too long, a **"Chrome-style" Floating Message** (Retry/Wait) appears. Handles **Zero-Data States** gracefully.
**FRs covered:** FR6, FR7, FR9, FR10.
**Includes**: Generate Button, Floating Load Bar (Processing), Recharts/VisX (Smart Layouts), **IndexedDB Caching** (Persists on Refresh), Backend Session Validation, **Timeout Recovery UI (Wait/Retry)**, **Zero-State Handling**.

---

## Epic 1: Foundation & "One-Click" Access

### Story 1.1: Project Shell & Monorepo Setup
As a **Developer**,
I want **a configured Monorepo with React+Vite and FastAPI**,
So that **I have a solid foundation for the "Illusionist" architecture.**

**Acceptance Criteria:**
**Given** a clean environment
**When** I initialize the project
**Then** the directory structure should match `architecture.md` (frontend/, backend/)
**And** the Frontend should use a **Dark Mode Only** theme (Premium Aesthetics)
**And** the Backend should run on localhost:8000 with FastAPI
**And** a "Health Check" endpoint (`GET /health`) should return 200 OK.

### Story 1.2: User Identity & Single Instance Enforcement
As a **User**,
I want **to log in via Google OAuth and have only one active tab**,
So that **I don't create sync conflicts or data duplication.**

**Acceptance Criteria:**
**Given** the login page
**When** I click "Sign in with Google"
**Acceptance Criteria:**
**Given** the login page
**When** I click "Sign in with Google"
**Then** I should be redirected to the provider and back to the App Shell
**And** the app should check for **Existing Active Sessions** (via Supabase Realtime Presence)
**When** an Active Session is detected (Conflict)
**Then** the app should **NOT** log me in
**But** should trigger a **Global Sign Out** (killing the ghost session AND clearing LocalStorage)
**And** show a Toast: "Logged out of all active instances. Please login again."
**When** I click "Sign in" again
**Then** login should succeed and register my new session as Active.

### Story 1.3: Fluid Navigation Architecture
As a **User**,
I want **instant transitions between pages (View Transitions)**,
So that **the app feels like a native tool with no white flashes.**

**Acceptance Criteria:**
**Given** I am on the Home page
**When** I hover over a Sidebar link
**Then** the route chunk should be prefetched
**When** I click the link
**Then** the Content Pane should cross-fade (View Transition) while the Sidebar stays fixed (GPU Layer).

### Story 1.4: State Persistence Engine
As a **User**,
I want **my application state to survive a tab reload**,
So that **I don't lose context if I accidentally refresh.**

**Acceptance Criteria:**
**Given** I have data in the Zustand store
**When** I refresh the page
**Then** the app should initialize the Zustand store with persisted data **before the first UI render** (preventing flash of empty state)
**And** I should see the same screen state as before.

### Story 1.5: Offline Capability & Network Handling
As a **User**,
I want **to know when I go offline**,
So that **I don't try to perform network actions that will fail.**

**Acceptance Criteria:**
**Given** the app is running
**When** I disconnect my network
**Then** a global "Offline Mode" indicator should appear
**And** the app should switch to "Read-Only" mode (preventing **User Initiated** new API calls; System Retries allowed).

### Story 1.6: Storage Quota Watchdog
As a **User**,
I want **to be warned if I'm running out of space**,
So that **my experience doesn't crash unexpectedly.**

**Acceptance Criteria:**
**Given** the app uses IndexedDB
**When** the available quota drops below 10% (via `navigator.storage.estimate`)
**Then** a polite Warning Toast should appear advising me to clear cache.

## Epic 2: Staging & Batch Ingestion

### Story 2.1: Persistent Staging Area
As a **User**,
I want **to drag and drop files into a Staging Area**,
So that **I can prepare a batch of files for upload.**

**Acceptance Criteria:**
**Given** the Staging View
**When** I drag a file over the drop zone
**Then** the zone should expand magnetically
**When** I drop a **Valid** file OR press **Ctrl+V** (Paste)
**Then** a "Ghost Card" should appear immediately
**When** I click a card
**Then** it should become **Selected** (Visual Highlight)
**When** I press **Delete**
**Then** the Selected card should be removed from the Staging Area
**When** I drop an **Invalid** file
**Then** the drop zone should **Shake**
**And** show a Toast: "Invalid file format".

### Story 2.2: Batch Upload Orchestrator
As a **User**,
I want **to click "Upload Batch" to send my staged files**,
So that **I can begin the ingestion process.**

**Acceptance Criteria:**
**Given** staged files in the Staging Area
**When** I click "Upload Batch" UI
**Then** the items should lock (immutable) and show a "Zeno Bar" (Asymptotic Progress)
**And** the system should begin sequentially processing the files.

### Story 2.3: Single Instance Lock (Anti-Zombie)
As a **System**,
I want **to prevent multiple tabs from writing to the same session**,
So that **data integrity is preserved.**

**Acceptance Criteria:**
**Given** an active session in Tab A
**When** I open Tab B
**Then** Tab A should receive a `BroadcastChannel` signal
**And** Tab A should immediately switch to a **"Paused/Locked"** overlay state
**And** only Tab B should be allowed to write to IndexedDB or upload files.

### Story 2.4: Headless Ingestion & Binary Streaming
As a **System**,
I want **to separate metadata from binary upload**,
So that **the interface remains responsive.**

**Acceptance Criteria:**
**Given** a file to upload
**When** the upload starts
**Then** `POST /ingest/meta` should be called first (returning an ID)
**And** `PUT /ingest/blob/{id}` should stream the binary data **(Raw Request Body, NOT `multipart/form-data`)**
**And** if it's an image-only PDF, the backend should trigger the Tesseract fallback.

### Story 2.5: Resilient Error Handling & Retry Logic
As a **User**,
I want **network errors to be handled gracefully**,
So that **I don't lose my batch due to a hiccup.**

**Acceptance Criteria:**
**Given** a batch upload in progress
**When** a 5xx error occurs
**Then** the system should retry 3 times with exponential backoff
**And** if it still fails, show a Toast: "Upload failed. Please reload the page." (No technical details).

### Story 2.6: Batch Reset with Destructive Confirmation
As a **User**,
I want **to reset the batch if I made a mistake**,
So that **I can start over fresh.**

**Acceptance Criteria:**
**Given** a staging or processing batch
**When** I click "Reset Batch"
**Then** a Floating Confirmation Message should appear
**When** I confirm
**Then** the app should send a cancellation request (`POST /batch/cancel`) to the backend
**And** the batch should be cleared locally
**And** the **IndexedDB Dashboard Cache should be invalidated** (Parent Reset wipes Child)
**And** a signal should be sent to clear it in all other open tabs.

## Epic 3: Session-Based Dashboard & Smart Reporting

### Story 3.1: Session Report Generation & Validation
As a **User**,
I want **to click "Generate Report" after a batch upload**,
So that **I can view the insights.**

**Acceptance Criteria:**
**Given** a batch upload is **in progress**
**Then** the Generate button should be **Unclickable** and show "Uploading..." with a subtle animation
**When** the upload completes (Zeno Bar 100%)
**Then** the button should transform to a **Clickable** "Generate Report" state
**When** I click it
**Then** the Backend should validate the current Batch ID and start calculation.

### Story 3.2: Floating Process Monitor with Recovery
As a **User**,
I want **to see the progress of report generation**,
So that **I know the system is working.**

**Acceptance Criteria:**
**Given** report generation is active
**Then** a Floating Load Bar should show **percentage completion (0-100%)** AND **Current Stage (e.g., "Normalizing...", "Clustering...")**
**And** if it stalls for >30s, a "Taking longer than usual..." message with **"Poke Worker" (Force Retry)** and "Wait" buttons should appear.

### Story 3.3: Network-Independent Dashboard Cache
As a **User**,
I want **my dashboard to be available even if I disconnect**,
So that **I can analyze data offline.**

**Acceptance Criteria:**
**Given** a generated dashboard
**When** I refresh the page or go offline
**Then** the dashboard should load instantly from IndexedDB
**And** NOT make a new network request to the backend.

### Story 3.4: Adaptive Smart Visualizations
As a **User**,
I want **charts that adapt to the data available**,
So that **I don't see broken UI.**

**Acceptance Criteria:**
**Given** dataset A (Time Series) and dataset B (No Time)
**When** the dashboard renders
**Then** Dataset A should use a Line Chart
**And** Dataset B should automatically switch to a Bar Chart/Distribution
**And** if data points > 1,000, it should use **Data Decimation (LTTB Algorithm)** to downsample to <1,000 points while preserving visual shape (maintaining 60FPS using Recharts).

### Story 3.5: Empty State & Edge Case Handling
As a **User**,
I want **a clear message if my data produced no results**,
So that **I don't think the system is broken.**

**Acceptance Criteria:**
**Given** a valid batch that yields 0 metrics
**When** the dashboard loads
**Then** a "Zero Data" state should be shown with helpful context
**And** the layout should not collapse or look broken.

### Story 3.6: Dashboard Regeneration (Child Reset)
As a **User**,
I want **to regenerate the report without re-uploading the files**,
So that **I can fix a glitch or retry a stuck generation.**

**Acceptance Criteria:**
**Given** an active Dashboard
**When** I click "Regenerate Report"
**Then** the **Dashboard Cache should be cleared**
**And** the Report Generation process (Story 3.1) should restart
**But** if the Parent Batch is expired/deleted (404), show a Toast "Session Expired. Please re-upload."
**And** otherwise, the Parent Batch (uploaded files) should **remain intact**.

### Epic 1: The Smart Dashboard (View & Logic)
**Goal**: Users can automatically view the most coherent and high-density visualization for their dataset without manual configuration. The system intelligently pivots based on available data satellites (time, title, cluster).
**FRs covered:** FR1, FR2, FR3

### Epic 2: Reactive Generation Logic (Async & UX)
**Goal**: Users can trigger complex analytical reports without freezing the browser. The system provides immediate "Zeno" feedback, handles long-running jobs asynchronously, and adheres to strict session-bound security boundaries (5s Rule).
**FRs covered:** FR5, FR6, FR7, FR8, NFR3, NFR4

### Epic 3: Dynamic Exploration Component (Pivoting)
**Goal**: Users can effectively "Pivot" their view of the data (e.g., swapping from "Title" to "Cluster" view) instantly. The dashboard respects data integrity, requiring regeneration if source files are modified.
**FRs covered:** FR4, FR9, FR10, NFR1, NFR2

## Epic 1: The Smart Dashboard (View & Logic)

The Smart Dashboard is the "Brain" of the visualization system. It acts as the decision-maker that inspects the raw data and automatically determines the most effective way to present it, removing the need for the user to configure charts manually.

### Story 1.1: Backend Satellite Detection Logic

As a System,
I want to analyze uploaded datasets to detect "Satellite" columns,
So that I can determine the optimal layout strategy without user input.

**Acceptance Criteria:**

**Given** a pandas DataFrame loaded from an uploaded file (CSV/JSON/Parquet)
**When** the `detect_satellites` function is run
**Then** it should return a list of present dimensions (Timestamp, Title, Cluster, Confidence)
**And** it should return a `LayoutStrategy` Enum: `TEMPORAL_SUPREME` (if Timestamp exists) or `SNAPSHOT_PIVOT`.

### Story 1.2: Scenario A - Temporal Layout Rendering

As a User,
I want to see a Multi-Line Area Chart if my data contains time-series information,
So that I can understand trends (Positive/Negative/Neutral) over time immediately.

**Acceptance Criteria:**

**Given** the backend returns `LayoutStrategy.TEMPORAL_SUPREME`
**When** the dashboard renders
**Then** the Anchor Widget (Top) must be a Multi-Line Area Chart
**And** the X-Axis must be Time, and Y-Axis must be Article Count by Sentiment
**And** the Anchor dropdown must be disabled (this view is mandatory).

### Story 1.3: Scenario B - Snapshot Pivot Rendering

As a User,
I want to see a Consolidated or Diverging view if my data is time-agnostic,
So that I can analyze performance by Entity or Cluster.

**Acceptance Criteria:**

**Given** the backend returns `LayoutStrategy.SNAPSHOT_PIVOT`
**When** the dashboard renders
**Then** the Anchor Widget must default to "Consolidated View" (Combo Chart) or "Diverging View" (Bar Chart) based on available satellites
**And** the Anchor dropdown must be enabled to allow pivoting.

## Epic 2: Reactive Generation Logic (Async & UX)

This epic covers the "Invisible" infrastructure that makes the "Heavy" analysis feel "Light". It enforces the 300ms rule by moving work to the background and managing the user's perception of time via the "Zeno Barrier".

### Story 2.1: Async Job Dispatch (Backend)

As a Developer,
I want to offload report generation to a PGMQ worker,
So that the API thread is never blocked for more than 300ms.

**Acceptance Criteria:**

**Given** a `POST /reports/request` call
**When** received
**Then** the backend must push a `generate_report` job to the PGMQ `report_queue`
**And** immediately return a `job_id` to the client
**And** the worker process should pick up the job and run the analysis logic.

### Story 2.2: Zeno Barrier UI Implementation

As a User,
I want to see a smooth, non-stalling progress animation while the report generates,
So that I know the system is working and I am not blocked from waiting.

**Acceptance Criteria:**

**Given** a report generation request is initiated
**When** the request is in flight
**Then** the main dashboard area should Blur
**And** a "Zeno Progress Bar" should appear (moving asymptotically to 99% but never stalling)
**And** interaction with the blurred area should be disabled.

### Story 2.3: Polling and Verification

As a User,
I want the UI to check for completion and display the result automatically,
So that I don't have to refresh the page manually.

**Acceptance Criteria:**

**Given** a `job_id` from the request
**When** the frontend polls `GET /reports/poll/{job_id}`
**Then** it should receive a status (`pending`, `completed`, `failed`)
**And** if `completed`, it should fetch the Report Artifact and lift the Zeno Barrier
**And** if `failed` or timeout (>30s), it should show a "Retry" button.

### Story 2.4: The 5-Second Ephemerality Rule

As a User,
I want the system to reset if I abandon the generation process,
So that I don't see stale or confusing states from previous sessions.

**Acceptance Criteria:**

**Given** the Zeno Barrier is active
**When** I navigate away or reload the page and return after > 5 seconds
**Then** the barrier should be gone and the state reset to "Input Required"
**And** any pending polling for the old session should be cancelled.

---

## Functional Requirements (Epic 4)

FR15: **Issue Creation (Senior-Only)**: Seniors can create issues with immutable descriptions, assigned teams, severity tags, optional deadlines, and parent/chained ticket references.
FR16: **Issue Update Nodes**: Assigned team members can propose update nodes on the issue tree. Each node has a title, author, timestamp, and description.
FR17: **Status Tag Semantics**: Seniors tag nodes with 🟢 Green (Accepted), 🔴 Red (Rejected), 🟡 Yellow (Provisional/Replaceable), or 🔵 Blue (Accepted but Incomplete). Tags carry senior comments visible to the node creator.
FR18: **Blue Branch & Merge Flow**: Blue-tagged nodes spawn temporary side branches. Branches must merge (collapsing into a single green "pill of truth" with full metadata) or be discontinued before the issue can be closed.
FR19: **Visual Resolution Tree (DAG)**: Each issue renders as a directed acyclic graph (flowchart) in the central pane, showing the full lifecycle of issue resolution with connected node cards.

### NFRs (Epic 4)

NFR8: **Role-Based Option Visibility**: Option 3 (Issue Control) is visible only to Seniors/Leads. Option 4 (Resolution View) is visible to all assigned users. Non-senior users cannot see or access Option 3.

### FR Coverage Map (Epic 4 Additions)

FR15: Story 4.1
FR16: Story 4.2, Story 4.5
FR17: Story 4.3
FR18: Story 4.4
FR19: Story 4.6, Story 4.7

---

## Epic 4: Issue Tracker & Visual Resolution System (The Execution Ledger)

**Goal**: Transform Cortex into a strict decision ledger for production. Option 3 provides governance (Issue Creation, Team Assignment, Metadata Control) and is restricted to Seniors. Option 4 provides a visual resolution history (DAG) restricted to the Assigned Team. This is an unforgiving, lossy system enforcing accountability over exploration.
**FRs covered:** FR15, FR16, FR17, FR18, FR19. **NFRs**: NFR8.
**Includes**: Role-Based Option Visibility (Seniors vs. Assigned Teams), Issue Creation (Option 3), **Immutable Descriptions**, Active/Closed Infinite Scroll (Option 4), **Interactive DAG Canvas** (React Flow), Strict Node Logic (Yellow/Blue/Green/Red), Branching/Merging Rules (Ruthless Cleanup), 30-min Owner Deletion window.

### Design Philosophy (Non-Negotiable)

This system is:
- A **visual decision ledger** — not a chat platform, collaboration tool, or credit tracker.
- A **lossy, curated representation** of issue resolution — rejected ideas are discarded, execution branches are compressed, only final accepted truth survives visually.
- A **discipline-enforcing execution tracker** — it assumes trained developers, disciplined seniors, external communication tools, and real consequences.
- **Intentionally unforgiving** — it rewards discipline and punishes carelessness. It trusts hierarchy and enforces responsibility.

### Roles & Permissions

**Seniors / Team Leads:**
- Create issues, assign teams, define deadlines and severity
- Tag nodes (green / red / yellow / blue) with mandatory comments
- Restrict branches, approve merges
- Create end nodes (close issues)

**Team Members (Developers):**
- View all assigned issues and full issue trees
- Propose update nodes
- Own and work on branches they create
- Delete their own nodes within 30 minutes of creation only

**No one can:**
- Delete others' nodes
- Alter tagged decisions
- Modify closed issues

---

### Story 4.1: Option 3 — Governance & Immutable Issue Creation (Seniors Only)

As a **Senior/Lead**,
I want **to create issues with immutable core descriptions and full lifecycle control**,
So that **I can govern the requirements without mid-flight ambiguity.**

**Acceptance Criteria:**
**Given** I am logged in with a `Senior` role
**When** I access Option 3 (Service Hub)
**Then** I can create an issue detailing: Title, Body, Assigned Team, Severity, and optional Parent/Chained Ticket IDs.
**When** the issue is created
**Then** the description becomes strictly **Immutable** (carved in stone).
**But** Non-Senior users **CANNOT** access or see Option 3 at all.

**Issue Fields:**
- Ticket number (auto-generated)
- Title
- Detailed description (authoritative problem statement)
- Assigned team
- Severity (critical / important / minor)
- Optional deadline
- Optional parent ticket number (for re-opened issues)
- Optional "chained to" ticket number (linked-list semantics)

---

### Story 4.2: Option 3 — Issue Update Push (Seniors Only)

As a **Senior/Lead**,
I want **to push updates, modify metadata, and control the lifecycle of existing issues from Option 3**,
So that **governance stays centralized and separate from the visual resolution view.**

**Acceptance Criteria:**
**Given** an existing issue with a known ticket number
**When** I access Option 3
**Then** I can push updates using the ticket number
**And** I can modify metadata (severity, deadline, assigned team)
**And** I can link issues (parent / chained)
**And** I can control lifecycle (open / close).
**But** Option 3 does not visualize history or the issue tree.

---

### Story 4.3: Status Tag System & Branching Gates (The Hierarchy of Truth)

As a **Senior/Lead**,
I want **to enforce structural gates based on node tags**,
So that **the resolution path follows a strict, validated evolution.**

**Acceptance Criteria:**

**🟡 Yellow — Provisional / Replaceable:**
- **Status**: Visual placeholder for ideas.
- **Stacking**: Multiple yellow nodes can coexist under a parent.
- **Cleanup Rule**: All sibling yellow nodes are **automatically deleted** when any sibling is tagged **Green** or **Blue**.
- **Hard Constraint**: Yellow nodes **cannot have children**. They are terminal until promoted.

**🔵 Blue — Accepted but Incomplete (The Branch Gate):**
- **Status**: Permission to explore a side-track.
- **Structural Action**: Spawns a side branch (Left or Right). Max **2 side branches** (Left+Right) per node.
- **Main Branch Lock (The Gatekeeper)**: Progress on the parent's current branch (vertical children) is **blocked** until at least one child of the blue branch is tagged with any valid color (Green/Blue/Red).
- **Staircase Logic**: Side branches can generate their own nested blue side branches recursively ($B_2$ off $B_1$).

**🟢 Green — Accepted Truth:**
- **Status**: Validated resolution step.
- **Merge Outcome**: When a side branch is successfully merged, its Blue parent turns Green.

**🔴 Red — Rejected / Finality:**
- **Main Branch**: If the **End Node** of the main branch is Red, the issue is closed and the entire graph becomes **Immutable**.
- **Side Branch (The Axe)**: If a node on a side branch is tagged Red, the **entire sub-tree** below it (the branch trail) is **permanently deleted**.
- **Fault Isolation**: Only the sub-branch is truncated; the original Blue parent remains Blue (allowing a fresh start) and the main branch remains unaffected.

---

### Story 4.4: Recursive Merge & Path Persistence

As a **Senior/Lead**,
I want **to merge side branches into their parents via a validated documentation flow**,
So that **the audit trail remains visible while the "truth path" is established.**

**Acceptance Criteria:**
- **Merge Constraint (Recursive Order)**: A branch $B_1$ can only merge if ALL nested child branches ($B_2, B_3$) under it are resolved (No Blue nodes present on the trail).
- **Merge flow**:
    1. **Trigger**: User connects a branch-end node to a parent node (or via explicit Merge action).
    2. **Recursive Check**: System verifies no unresolved blue nodes exist between the connect point and the Blue Parent.
    3. **Pop-up Form**: The **Edit Node** modal opens for the Blue Parent to capture final branch findings/code.
    4. **Finality**: Upon save, the Blue Parent turns **Green** and the connection is sealed.
- **Bridge Rule**: Connections between different side-branches (e.g., Left-branch node to Right-branch node) are **blocked**.
- **Persistence**: Unlike V1, successfully merged side-branches are **NOT removed**; they stay visible as a permanent historical trail.

---

### Story 4.5: Optimistic Concurrency & Deletion Rules

As a **User**,
I want **structural changes to be protected by versioning and time-windows**,
So that **conflicting senior decisions do not corrupt the resolution tree.**

**Acceptance Criteria:**
- **Optimistic Concurrency Control (OCC)**: Every backend update (Tagging, Deferring, Merging) requires matching the `updated_at` timestamp. If a node was modified (e.g., tagged Red) while a user had the Merge form open, the operation must fail.
- **Deletion Window**: Team members can delete their own **Pending** nodes only if:
    1. The node is < 30 minutes old.
    2. The node has **no validly tagged children** (Blue/Green/Red).
- **Logic**: If a Senior tags a child of a pending node, that pending node is effectively "locked" even if still within 30m.

---

### Story 4.5: Node Deletion Rules (30-Minute Window)

As a **Team Member**,
I want **to delete a node I accidentally created**,
So that **I can correct genuine mistakes without polluting the tree.**

**Acceptance Criteria:**
**Given** I created a node
**When** the node is less than 30 minutes old (based on the creation timestamp and the world clock in the right sidebar)
**Then** I can delete it
**But** after 30 minutes, the node becomes permanent
**And** I can **NEVER** delete another user's node
**And** tagged nodes (green/red/yellow/blue) **CANNOT** be deleted regardless of time.

---

### Story 4.6: Option 4 — Issue List View (All Assigned Users)

As a **Team Member or Senior**,
I want **to see all issues assigned to me or my team**,
So that **I can quickly identify what needs my attention.**

**Acceptance Criteria:**
**Given** I am logged in
**When** I open Option 4 (Integrations)
**Then** I see a list of issue cards assigned to my user or my team only
**And** I do **NOT** see other teams' issues (enforced silos)
**And** each card shows: Ticket Number, Title, Creation Date, Deadline (if any), Severity Tag, Category.

---

### Story 4.7: Option 4 — Issue Tree View (Interactive DAG Canvas)

As a **Team Member or Senior**,
I want **to open an issue and see its full resolution tree as an interactive flowchart**,
So that **I can visually trace the decision-making history.**

**Acceptance Criteria:**
**Given** I open an issue from the list
**Then** the top of the screen shows: Ticket Number, Creation Date, Deadline (if present)
**And** the **Central Pane** renders the Issue Tree (DAG) using React Flow
**And** the **Right Sidebar** displays the issue description (when the root node is selected) or the node's update description (when any other node is selected)
**And** all actions (tagging, adding nodes, merge requests) are in the Central Pane only — the sidebar is strictly **read-only context**.

**For Seniors:**
**When** viewing any untagged node
**Then** "Approve" and "Reject" action buttons are visible within the node card
**But** team members only see the status tag and content — no action buttons.

---

### Story 4.8: Issue Closure (End Node)

As a **Senior/Lead**,
I want **to formally close an issue by creating an End Node**,
So that **the decision is final and the tree is sealed.**

**Acceptance Criteria:**
**Given** an open issue with no unresolved blue branches
**When** the senior creates an End Node
**Then** the issue is closed permanently
**And** no further nodes can be added
**And** the issue tree becomes a sealed, read-only historical record.

**If work is required again:**
- A new issue is created via Option 3
- The `parent_ticket` field links back to the closed issue
- The optional `chained_to` field links ongoing context
- This avoids reopening clutter and preserves clean linked-list semantics.

---

### Story 4.9: Branching Rules & Safety Checks (Hard Constraints)

As a **System**,
I want **to enforce strict branching and merge constraints**,
So that **the resolution tree preserves integrity and prevents orphan paths.**

**Acceptance Criteria:**
- **Root Protection**: The Root Issue node is strictly read-only after creation; it cannot be tagged or deleted.
- **Branch Limitation**: Max 2 branches (Left/Right) per node. Branches must be visually and logically distinct.
- **Gatekeeping**: A Blue parent blocks its local main-path progress until its side-branch is "proven" (at least one tagged child).
- **Recursive Finality**: The "Close Issue" action is blocked if ANY Blue nodes exist anywhere in the DAG.
- **Identity Maintenance**: If a side-branch is deleted (Red cascade) or a node is deleted (30m window), the associated "slot" (Left/Right) is immediately freed for a fresh attempt.
- **Merge Exclusivity**: Merging is only allowed between a side-branch and its direct parent branch.

---

### Explicit Non-Goals (V1)

The Issue Tracker V1 intentionally does **NOT** include:
- Chat or inline discussion
- Soft drafts or WIP markers
- Anonymous edits
- Credit scoring or contribution metrics
- Ethical mediation or conflict resolution
- Infinite history preservation (lossy by design)
- Cross-team issue visibility
- Automated nudges, reminders, or escalation
- Inactivity detection (stalled / abandoned states)

Communication happens **outside** this system (Slack, Email, in-person).

---

### V1 Acceptance Criteria (System-Level)

V1 is considered complete when:
- Issues can be created and assigned (Option 3, Seniors only)
- Teams can propose update nodes (Option 4)
- Yellow / Blue / Green / Red tag logic works correctly
- Blue branches can be created and merged (collapsing into green pills of truth)
- Trees remain readable (yellow cleanup, branch collapse)
- End nodes enforce closure (no unresolved branches allowed)
- 30-minute node deletion window works
- Role-based visibility is enforced (Option 3 hidden from non-seniors)

Anything else is V2.
