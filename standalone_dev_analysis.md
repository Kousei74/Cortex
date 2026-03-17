# Analysis: Standalone Developer Blockers & Sanitation Plan

## The "Triple Epic 3" Problem
A "Standalone Developer" operates without immediate access to the Architect or Backend Developer. They rely 100% on the written spec (Markdown files).

Currently, `epics-and-stories.md` is an append-only log, resulting in three conflicting definitions of "Epic 3":

1.  **Epic 3 (Legacy v1)**: "Session-Based Dashboard". Focuses on "Floating Load Bars" and "IndexedDB Caching".
    *   *Status*: Partially valid (Caching is good), but the UI Logic is outdated (doesn't mention Resolution).
2.  **Epic 3 (Legacy v2)**: "Dynamic Exploration". Focuses on "Data Decimation" and "Canvas Fallback".
    *   *Status*: Confusing. It introduces requirements (LTTB Algorithm) that are not in the V1 Finalized plan.
3.  **Epic 3 (Finalized V1)**: "Issue Resolution Interface". Focuses on "Bulk Resolve", "Satellites", and "Sharding".
    *   *Status*: **The Source of Truth**.

**The Risk**: A developer might implement the "Canvas Fallback" (Legacy v2) which takes 3 days, only to find out it was cut from the V1 Finalized plan.

## The Missing Link: Data Contracts
Even if the developer picks the right Epic, they cannot build the UI components without the **Data Structure**.

*   **Story**: "Frontend switches Anchor widget source data using pre-loaded shard."
*   **Dev Question**: "Okay, is the shard an array `[{x:1, y:2}]`? Or a column layout `{x: [1], y: [2]}`? Do I need to parse functionality? What are the key names?"

Without a contract, the Frontend dev is blocked until the Backend dev finishes the API. This defeats the purpose of "Standalone/Parallel" development.

## The Fix: Sanitation & Contracts

We will apply the following transformations:

1.  **Deprecation Labels**: Add `> [!CAUTION] DEPRECATED` alerts to the Legacy sections. We keep the text (for reference) but explicitly warn against implementation.
2.  **Source of Truth Label**: Add `> [!NOTE] AUTHORITATIVE SPEC` to the V1 Finalized section.
3.  **API Appendix**: Add a new section `## 6. API Data Contracts` that defines the exact JSON payloads for:
    *   `POST /reports/request` (Input)
    *   `GET /reports/poll` (Output)

This transforms the document from a "History Log" into a "Actionable Handbook".
