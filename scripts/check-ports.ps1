# Check port status - shows real vs orphaned TCP entries
param(
    [int[]]$Ports = @(3000, 3010, 9400)
)

Write-Host "Checking port status...`n"

foreach ($port in $Ports) {
    Write-Host "=== Port $port ===" -ForegroundColor Cyan
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

    if (-not $connections) {
        Write-Host "  No connections" -ForegroundColor Green
        continue
    }

    $grouped = $connections | Group-Object State
    foreach ($group in $grouped) {
        Write-Host "  $($group.Name): $($group.Count) connection(s)"
    }

    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne 0 }
    foreach ($procId in $processIds) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  REAL: PID $procId ($($proc.ProcessName))" -ForegroundColor Yellow
        } else {
            Write-Host "  ORPHAN: PID $procId (process dead, TCP entry will timeout)" -ForegroundColor DarkGray
        }
    }
}

Write-Host "`nNote: Orphaned entries auto-clear in 30-120 seconds. They don't block new processes."
