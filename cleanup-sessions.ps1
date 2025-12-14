# Cleanup script for Playwright MCP sessions
# Usage: .\cleanup-sessions.ps1

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Playwright MCP Session Cleanup Utility" -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

# Function to get current sessions
function Get-CurrentSessions {
    Write-Host "[INFO] Checking for active sessions..." -ForegroundColor Gray
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/sessions" -Method Get -ErrorAction Stop
        Write-Host "[SUCCESS] Found $($response.count) active session(s)" -ForegroundColor Green
        if ($response.sessionIds.Count -gt 0) {
            Write-Host "[INFO] Session IDs:" -ForegroundColor Gray
            $response.sessionIds | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
        }
        return $response
    } catch {
        Write-Host "[WARNING] Could not connect to server: $($_.Exception.Message)" -ForegroundColor Yellow
        return $null
    }
}

# Function to trigger cleanup
function Invoke-Cleanup {
    Write-Host ""
    Write-Host "[ACTION] Sending cleanup request to server..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/cleanup" -Method Post -ErrorAction Stop
        Write-Host "[SUCCESS] Cleanup completed!" -ForegroundColor Green
        Write-Host "[INFO] $($response.message)" -ForegroundColor Gray
        Write-Host "[INFO] Timestamp: $($response.timestamp)" -ForegroundColor Gray
    } catch {
        Write-Host "[ERROR] Cleanup failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to kill orphaned Chrome processes
function Kill-OrphanedProcesses {
    Write-Host ""
    Write-Host "[ACTION] Killing orphaned Chrome processes..." -ForegroundColor Cyan
    
    $processes = Get-Process -Name chrome -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "[INFO] Found $($processes.Count) Chrome process(es)" -ForegroundColor Gray
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "[SUCCESS] Orphaned Chrome processes terminated" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No orphaned Chrome processes found" -ForegroundColor Gray
    }

    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "[WARNING] Found $($nodeProcesses.Count) Node process(es) still running" -ForegroundColor Yellow
    }
}

# Main cleanup flow
Write-Host ""
Write-Host "========== Step 1: Check Active Sessions ==========" -ForegroundColor Cyan
Get-CurrentSessions

Write-Host ""
Write-Host "========== Step 2: Remote Cleanup via Server ==========" -ForegroundColor Cyan
Invoke-Cleanup

Write-Host ""
Write-Host "========== Step 3: Kill Orphaned Processes ==========" -ForegroundColor Cyan
Kill-OrphanedProcesses

Write-Host ""
Write-Host "========== Step 4: Verify Cleanup ==========" -ForegroundColor Cyan
Start-Sleep -Seconds 2
Get-CurrentSessions

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Cleanup completed!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
