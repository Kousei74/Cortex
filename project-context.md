---
project_name: 'Cortex'
user_name: 'Kousei'
date: '2026-01-21'
sections_completed: ['technology_stack', 'critical_rules', 'coding_patterns']
existing_patterns_found: 0
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

_Derived from CORTEX Blueprint (overview.txt)_

### Frontend (The "Illusionist" Layer)
*   **Core Framework**: React (Implied by Component/Hook architecture)
*   **State Management**: `Zustand` (with `persist` middleware for LocalStorage)
*   **Animation & Motion**:
    *   `Framer Motion` (LayoutGroup, shared layout animations)
    *   **Native**: `View Transitions API` (for page/route transitions)
*   **Data Visualization**:
    *   `Recharts` (SVG-based for standard charts)
    *   `visx` (Canvas-based fallback for >10k data points)
*   **Performance**:
    *   Web Workers (Heavy math/parsing)
    *   Service Workers (Network handling)
    *   `ResizeObserver` (Polyfilled if needed)

### Backend (The "Shadow" Engine)
*   **API Pattern**: Asynchronous/Event-driven (Implied "Accept First, Process Later")
*   **Queue/Async**: `PGMQ` (Postgres Message Queue) with `visibility_timeout`
*   **Database**: `Supabase` (Postgres), `Redis` (Caching)
*   **Storage**: Supabase Storage
*   **Hosting/Edge**: `Vercel` (Edge Caching directives)
*   **Processing**: `Tesseract` (OCR Fallback)

---

## Critical Implementation Rules

### 1. The "Locally Optimistic" Philosophy
*   **The Rule of 300ms**: Any action > 300ms MUST use a specialized animation/transition. Generic spinners are **BANNED**.
*   **Client is Truth**: UI updates immediately (Optimistic UI). Server synchronization happens in the background.
*   **Anti-Stutter**: UI must maintain 60 FPS. Offload heavy parsing/math to Web Workers.

### 2. "Hole-Less" UX Patterns
*   **Uploads**:
    *   **Ghost Card**: Immediate visual feedback upon file drop/selection (temp ID, interactive).
    *   **Zeno's Progress Bar**: Progress bar NEVER stalls. Uses asymptotic approach (slower at 90%) if server is processing.
    *   **Background Processing**: "Invisible" retries on 5xx errors.
*   **Navigation**:
    *   **View Transitions**: Header/Sidebar fixed (GPU layer); only content pane transitions.
    *   **Prefetching**: Route prefetch on link hover.
*   **Layout Stability**:
    *   **Skeleton Identity**: Skeletons must match exact height of content to prevent CLS.
    *   **Fluid Repair**: If a component fails (e.g., chart error), neighboring components slide (LayoutGroup) to fill the gap.

### 3. Backend & Data Integrity
*   **Shadow Ingestion**:
    *   Separate metadata (`POST /ingest/meta`) from binary (`PUT /ingest/blob/{id}`).
    *   Metadata returns ID in <10ms.
*   **Indestructible Queue**:
    *   Zombie Killer: Jobs hanging >30s must be reassigned.
    *   Dead Man's Switch: If Supabase unreachable -> Switch to Read-Only `IndexedDB` mode.
*   **Resource Management**:
    *   **Edge Caching**: Static dashboards cached for 60s via Vercel headers.
    *   **Pruning**: Raw ingest blobs deleted after 24h (processed JSON kept).
    *   **Optimization**: Convert PNG to AVIF on client before upload.

### 4. Code Structure & Quality
*   **Modular Architecture**: Code should be completely modular and easy to include new changes/features and also easy to point out bugs and errors in any specific components. As modular as it can get.

---

## Edge Case Handling (The "Black Swan" List)

1.  **Network Flakiness ("Flight Mode")**:
    *   Listen to `window.addEventListener('online')`.
    *   Show "Syncing changes..." toast immediately on reconnect.
2.  **Large Payload ("Huge Text PDF")**:
    *   **Chunked Parsing**: Return Summary first, stream full text later.
    *   Never block UI thread with massive JSON.
3.  **Process Hangs ("Forever Pending")**:
    *   Frontend Politeness Check: If status `processing` > 2 mins, trigger `/job/poke` to wake backend.

---

## Immutability Contract

The following are IMMUTABLE and must never be violated:
- Critical Implementation Rules
- Hole-Less UX patterns
- Locally Optimistic philosophy
- Performance guarantees (300ms rule, 60 FPS)
- Edge-case handling doctrines

The following are MUTABLE and may change with explicit user approval:
- Technology stack choices
- Libraries, frameworks, vendors
- Hosting providers
- Queue or storage implementations

If a proposed change conflicts with immutable rules, the change MUST be rejected.
