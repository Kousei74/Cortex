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
