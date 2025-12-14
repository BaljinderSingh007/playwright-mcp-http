# Quick Cleanup Reference

## 🚨 Session Timeout Error?

When you see: `WORKFLOW STOPPED: Step 10 timeout after 30016ms`

### Quick Fix (30 seconds):

```powershell
# Option 1: Use the cleanup script (RECOMMENDED)
cd c:\Users\baljinders\Documents\GitHub\Chatbot\playwright-mcp-http
.\cleanup-sessions.ps1

# Option 2: Manual cleanup
curl -X POST http://localhost:3000/cleanup

# Option 3: Nuclear option - Kill everything
taskkill /F /IM chrome.exe /T
taskkill /F /IM node.exe /T
```

## 📊 Check Server Health

```powershell
# See active sessions
curl http://localhost:3000/health

# Or with JSON parsing
(curl http://localhost:3000/health | ConvertFrom-Json).sessions
```

## ⚡ Before Each Workflow

```powershell
# 1. Cleanup old sessions
curl -X POST http://localhost:3000/cleanup

# 2. Wait for cleanup
Start-Sleep -Seconds 2

# 3. Run your workflow
curl -X POST http://localhost:3000/api/execute_workflow -Body @{workflow="bim-login-and-create.json"} | ConvertTo-Json
```

## 📝 What's Fixed

✅ Auto-cleanup on server startup
✅ Kills orphaned Chrome processes  
✅ Detects stale browser connections
✅ Health check endpoint
✅ Session listing endpoint
✅ Force cleanup endpoint
✅ Graceful shutdown cleanup

## 🔍 Debugging

```powershell
# Check if Node server is running
Get-Process node -ErrorAction SilentlyContinue

# Check if Chrome processes exist
Get-Process chrome -ErrorAction SilentlyContinue

# View server logs (run this instead of npm start)
npm start 2>&1 | Tee-Object "server.log"
```

## 📍 Key Files Modified

- `src/playwright/browser.ts` - Added cleanup methods
- `src/server.ts` - Added health/cleanup endpoints
- `cleanup-sessions.ps1` - Utility script
- `SESSION_CLEANUP_GUIDE.md` - Detailed documentation

See `SESSION_CLEANUP_GUIDE.md` for complete documentation.
