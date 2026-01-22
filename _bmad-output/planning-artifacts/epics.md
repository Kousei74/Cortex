---
stepsCompleted: ['step-01-validate-prerequisites']
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
FR13: **Tab Synchronization**: Sync upload progress/state across tabs using `BroadcastChannel`.
FR14: **Quota Management**: Warn user if LocalStorage is full.

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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
