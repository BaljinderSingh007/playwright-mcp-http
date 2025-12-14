# Session Cleanup & Process Management Guide

## Problem Overview

When running multiple workflows or restarting the server, old sessions may remain active, causing:
- **Session conflicts**: New requests can't acquire browser resources
- **Network timeouts**: Workflow steps timeout waiting for responses (e.g., "Step 10 timeout after 30s")
- **Resource leaks**: Orphaned Chrome processes consume memory
- **State pollution**: Old session state interferes with new workflows

## Solution Overview

The system now includes comprehensive session cleanup with:

1. **Automatic initialization cleanup** - Cleans orphaned processes on server startup
2. **Graceful shutdown** - Proper cleanup on SIGINT/SIGTERM
3. **Manual cleanup endpoints** - REST API for on-demand cleanup
4. **Session monitoring** - Health check and session listing endpoints
5. **Conflict detection** - Validates sessions before reuse

---

## Usage Guide

### 1. Server Cleanup Endpoints

#### Health Check
```bash
GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-14T18:41:00.000Z",
  "sessions": {
    "count": 1,
    "ids": ["1765718183847_abc123xyz"]
  }
}
```

#### List Active Sessions
```bash
GET http://localhost:3000/sessions
```

**Response:**
```json
{
  "count": 2,
  "sessionIds": ["session-001", "session-002"],
  "timestamp": "2025-12-14T18:41:00.000Z"
}
```

#### Force Cleanup
```bash
POST http://localhost:3000/cleanup
```

**Response:**
```json
{
  "success": true,
  "message": "All sessions and processes cleaned up",
  "timestamp": "2025-12-14T18:41:00.000Z"
}
```

### 2. Using the Cleanup Script (PowerShell)

```powershell
.\cleanup-sessions.ps1
```

This script:
1. ✅ Checks current active sessions via `/sessions` endpoint
2. ✅ Sends cleanup request to `/cleanup` endpoint
3. ✅ Kills orphaned Chrome processes
4. ✅ Verifies cleanup was successful

**Output Example:**
```
=====================================================================
Playwright MCP Session Cleanup Utility
=====================================================================

========== Step 1: Check Active Sessions ==========
[INFO] Checking for active sessions...
[SUCCESS] Found 2 active session(s)
[INFO] Session IDs:
  - 1765718183847_abc123xyz
  - 1765718184001_def456uvw

========== Step 2: Remote Cleanup via Server ==========
[ACTION] Sending cleanup request to server...
[SUCCESS] Cleanup completed!

========== Step 3: Kill Orphaned Processes ==========
[ACTION] Killing orphaned Chrome processes...
[SUCCESS] Orphaned Chrome processes terminated

========== Step 4: Verify Cleanup ==========
[SUCCESS] Found 0 active session(s)
```

### 3. Manual Cleanup (PowerShell)

```powershell
# Kill all Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Kill all Chrome/Chromium processes
Get-Process -Name chrome -ErrorAction SilentlyContinue | Stop-Process -Force

# Verify
Get-Process -Name node, chrome -ErrorAction SilentlyContinue
```

---

## Internal Implementation Details

### Browser Manager Enhancements

**File:** `src/playwright/browser.ts`

#### New Methods:

1. **`initialize()`**
   - Called automatically on first session creation
   - Cleans up orphaned Chrome processes from previous runs
   - Sets initialization flag to prevent re-initialization

2. **`forceCleanupAll()`**
   - Closes all open sessions
   - Closes the browser instance
   - Kills orphaned processes
   - Resets internal state
   - Can be safely called multiple times

3. **`cleanupOrphanedProcesses()`** (private)
   - Windows: Uses `taskkill /F /IM chrome.exe`
   - Unix/Linux: Uses `pkill -9 chrome`
   - Silently fails if no processes found

4. **`getSessionCount()` and `getAllSessionIds()`**
   - Utility methods for monitoring

#### Session Validation:
```typescript
// Verify session is still valid before reuse
try {
  await session.page.evaluate(() => true);
  console.log(`[SESSION] Reusing existing session: ${sessionId}`);
  return session;
} catch (error) {
  // Browser was closed, create new one
  this.sessions.delete(sessionId);
  this.browserInstance = null;
}
```

### Server Changes

**File:** `src/server.ts`

#### New Endpoints:
- `GET /health` - Server health and session count
- `GET /sessions` - List active sessions
- `POST /cleanup` - Trigger cleanup
- Updated `GET /` - Shows all available endpoints

#### Startup Cleanup:
```typescript
app.listen(PORT, async () => {
  // Initialize browser manager and cleanup on startup
  await browserManager.initialize();
});
```

#### Graceful Shutdown:
```typescript
process.on("SIGINT", async () => {
  await browserManager.forceCleanupAll();
  // Then close server
});
```

---

## Workflow Improvements for Reliability

### Before Making a New API Call:

```powershell
# 1. Check current sessions
curl -X GET http://localhost:3000/sessions

# 2. If sessions exist and might conflict, cleanup
curl -X POST http://localhost:3000/cleanup

# 3. Wait a moment
Start-Sleep -Seconds 2

# 4. Verify cleanup
curl -X GET http://localhost:3000/health

# 5. Now make your API call
curl -X POST http://localhost:3000/api/execute_workflow -Body $workflowJson
```

### Fixing the Timeout Issue:

The "Step 10 timeout after 30s" error typically occurs because:

1. ❌ **Old session still active** → Network request goes to stale session
2. ❌ **Browser instance disconnected** → Navigation fails silently
3. ❌ **Race condition** → Multiple sessions competing for resources

**Solution:**
```powershell
# Clean before each workflow
.\cleanup-sessions.ps1

# Then start fresh workflow
$workflowJson = @{
    workflow = "bim-login-and-create.json"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/execute_workflow" `
  -Method Post -Body $workflowJson -ContentType "application/json"
```

---

## Monitoring & Debugging

### Enable Debug Logging:
```typescript
// In browser.ts, logs include tags for easy filtering:
// [INITIALIZATION] - Startup activities
// [SESSION] - Session lifecycle events
// [CLEANUP] - Cleanup operations
// [BROWSER] - Browser instance events
// [SHUTDOWN] - Graceful shutdown events
```

### Check Server Logs:
```powershell
# Run server with full output
npm start

# Look for these patterns:
# [INITIALIZATION] - Indicates cleanup on startup
# [SESSION] Reusing existing session - Successful reuse
# [CLEANUP] - Cleanup in progress
```

### Monitoring Session Health:
```powershell
# Get health status
curl http://localhost:3000/health | ConvertFrom-Json

# Check specific field
(curl http://localhost:3000/health | ConvertFrom-Json).sessions.count
```

---

## Troubleshooting

### Issue: "WORKFLOW STOPPED: Step 10 timeout after 30016ms"

**Solution 1 - Quick Cleanup:**
```powershell
.\cleanup-sessions.ps1
```

**Solution 2 - Full Reset:**
```powershell
# Kill all processes
taskkill /F /IM chrome.exe
taskkill /F /IM node.exe

# Check cleanup
Get-Process chrome, node -ErrorAction SilentlyContinue
```

**Solution 3 - Increase Timeout:**
In workflow JSON, increase timeout for affected steps:
```json
{
  "action": "wait_for_network",
  "timeout": 60000  // Increase from 30000
}
```

### Issue: "Browser instance is disconnected"

**Cause:** Browser was closed but session cache not cleared

**Solution:**
```powershell
# Use the cleanup endpoint
Invoke-RestMethod -Uri "http://localhost:3000/cleanup" -Method Post
```

### Issue: Multiple Chrome windows open

**Cause:** Orphaned processes not cleaned on startup

**Solution:**
```powershell
# Cleanup orphaned processes
taskkill /F /IM chrome.exe /T
```

---

## Best Practices

✅ **DO:**
- Run `.\cleanup-sessions.ps1` before starting new workflows
- Monitor `/health` endpoint before making API calls
- Use graceful shutdown (Ctrl+C) to properly cleanup
- Check session count if experiencing timeouts

❌ **DON'T:**
- Kill Node process without cleanup
- Run multiple servers on same port
- Ignore "Browser disconnected" warnings
- Make rapid successive API calls without checking health

---

## Summary

| Feature | Benefit |
|---------|---------|
| **Auto-init cleanup** | No stale processes from previous runs |
| **Health endpoint** | Monitor session state before API calls |
| **Cleanup endpoint** | Force cleanup without server restart |
| **Graceful shutdown** | Proper resource cleanup on exit |
| **Cleanup script** | One-command cleanup workflow |
| **Session validation** | Detect disconnected browsers early |

The system now prevents session conflicts and timeouts through automatic cleanup and comprehensive monitoring!
