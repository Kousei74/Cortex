# CORTEX Verification Matrix - Phase 1 (Staging & Ingestion)

This document outlines the test strategy for the current implementation of the CORTEX Staging Area.

## 1. Feature: Drop Zone & Staging (The "Intention")

| ID | Test Scenario | Steps | Expected Result | Edge Case? |
|----|--------------|-------|-----------------|------------|
| **1.1** | **Basic Drag & Drop** | 1. Drag a valid `.csv` or `.json` file into the drop zone. | 'Ghost Card' appears *instantly*. Status is 'READY TO SYNC'. | No |
| **1.2** | **Extension Validation** | 1. Rename a valid file to `.exe` or `.js`. <br> 2. Drag it into the zone. | File is rejected. Drop zone shows red border/reject state. File is NOT added. | Yes |
| **1.3** | **Multiple Files** | 1. Select 5-10 valid files. <br> 2. Drag them simultaneously. | All files appear as individual cards in the grid. Scrollbar appears if needed. | No |
| **1.4** | **Grid Layout Flow** | 1. Add 3 files. <br> 2. Maximize/Resize window. | Cards rearrange responsively (3 cols -> 2 cols -> 1 col) without breaking layout. | No |
| **1.5** | **Empty State** | 1. Remove all files. | "INITIATE NEURAL LINK" empty state is visible with animation. | No |

## 2. Feature: Persistence (The "State Engineer")

| ID | Test Scenario | Steps | Expected Result | Edge Case? |
|----|--------------|-------|-----------------|------------|
| **2.1** | **Reload Persistence** | 1. Stage 3 files. <br> 2. Refresh the browser (F5). | ALL 3 files reappear instantly after reload. Status remains 'READY TO SYNC'. | No |
| **2.2** | **Tab Synchronization** | 1. Open App in Tab A and Tab B. <br> 2. Drop file in Tab A. | File *should* appear in Tab B (if `BroadcastChannel` is impl). **Current Impl Note**: Likely only works on reload if `idb-keyval` is sole mechanism. Verify if reactive. | Yes |
| **2.3** | **Clear Batch** | 1. Click 'Reset'. <br> 2. Confirm Dialog. | All files removed. Empty state appears. Persistence cleared. | No |

## 3. Feature: Input Methods (The "Magic")

| ID | Test Scenario | Steps | Expected Result | Edge Case? |
|----|--------------|-------|-----------------|------------|
| **3.1** | **Paste File** | 1. Copy a file from OS file explorer (Ctrl+C). <br> 2. Click Drop Zone (focus). <br> 3. Paste (Ctrl+V). | File is added to staging. | Yes |
| **3.2** | **Paste Screenshot** | 1. Take screenshot to clipboard (Win+Shift+S). <br> 2. Paste in Drop Zone. | Image is added as `screenshot_timestamp.png`. | Yes |
| **3.3** | **Magic Bytes (Security)** | 1. Rename `malicious.exe` to `data.csv`. <br> 2. Drag to zone. | **Implemented**: File is BLOCKED. Toast error appears. console.warn logs check failure. | **CRITICAL** |

## 4. Feature: Upload Execution (The "Tunnel")

| ID | Test Scenario | Steps | Expected Result | Edge Case? |
|----|--------------|-------|-----------------|------------|
| **4.1** | **Happy Path Upload** | 1. Click "ACTUALIZE UPLOAD". | UI locks/shows progress. Status changes to 'TRANSMITTING' -> 'SYNC COMPLETE'. | No |
| **4.2** | **Silent Healing (Retry)** | 1. Mock API fail 500. <br> 2. Watch UI. | Status text updates to "Optimizing route... (2 left)". Retry happens after backoff. | Yes |
| **4.3** | **Zeno Bar Behavior** | 1. Watch progress bar during upload. | **Implemented**: Bar moves smoothly. Even if network stalls, bar crawls towards 90%. | Diff Check |

## 5. Critical Edge Cases (The "Black Swan")

### 5.1 The "Flight Mode" Toggle (Implemented)
*   **Scenario**: User toggles Wi-Fi off and on rapidly.
*   **Verification**:
    *   **OFF**: 'Connection Lost' warning persists.
    *   **ON**: 'Connection Restored' success toast appears.
    *   **Upload**: If upload was retrying, it should resume (or at least fail gracefully).

### 5.2 The "Folder" Drop (Ambiguous)
*   **Scenario**: Drag an entire folder into the zone.
*   **Verification**: 
    *   Ideally: Rejects or stages internal files.
    *   Current: Verify if it crashes (Red Flag) or handled gracefully.

### 5.3 The "Large" File (Binary Stream)

### 5.2 The "Destructive" Navigation
*   **Scenario**: Upload is 50% done. User clicks "Dashboard" (Navigates away).
*   **Verification**: Does upload continue? (Service Worker?) Or does it die?
    *   *Current Codebase*: Likely dies as it is React State bound.
    *   *Requirement*: "Hole-Less" User Journey implies background continuation.

### 5.3 The "Duplicate" Drag
*   **Scenario**: User drags "Data_Jan.csv". Forgets. Drags "Data_Jan.csv" again.
*   **Verification**: Should detect duplicate and either:
    *   Shake card (Pulse) to show "Already staged".
    *   Prevent duplicate addition.
    *   *Current Code*: `addFiles` in store adds NEW uuid for everything. Likely duplicates allowed.

## Recommended Automated Verification Script

Create a `verify_staging.spec.js` (Playwright/E2E) that:
1.  Bypasses Login.
2.  Injects a File object into the DataTransfer event.
3.  Asserts `.ghost-card` count === 1.
4.  Reloads page.
5.  Asserts `.ghost-card` count === 1.
