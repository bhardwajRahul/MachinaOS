# Kill all processes using the specified ports (Windows)
# Usage: .\kill-port.ps1 [-Ports] 3000,3010,9400
# If no ports specified, uses default MachinaOs ports: 3000, 3010, 9400

param(
    [int[]]$Ports = @(3000, 3010, 9400)
)

$ErrorActionPreference = 'SilentlyContinue'

function Get-ProcessTree {
    param([int]$ParentId)

    $children = @()
    $childProcesses = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId" -ErrorAction SilentlyContinue

    foreach ($child in $childProcesses) {
        if ($child.ProcessId -and $child.ProcessId -ne 0) {
            $children += $child.ProcessId
            # Recursively get grandchildren
            $children += Get-ProcessTree -ParentId $child.ProcessId
        }
    }

    return $children
}

function Get-PortProcesses {
    param([int]$Port)

    $pids = @()

    # Method 1: Get-NetTCPConnection (preferred)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
                   Where-Object { $_.State -eq 'Listen' -or $_.State -eq 'Established' }

    if ($connections) {
        $pids += $connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne 0 }
    }

    # Method 2: netstat fallback
    if ($pids.Count -eq 0) {
        $netstatOutput = netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING|ESTABLISHED"
        foreach ($line in $netstatOutput) {
            if ($line -match '\s+(\d+)\s*$') {
                $pid = [int]$Matches[1]
                if ($pid -ne 0 -and $pids -notcontains $pid) {
                    $pids += $pid
                }
            }
        }
    }

    return $pids | Select-Object -Unique
}

function Stop-ProcessSafely {
    param([int]$ProcessId)

    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $proc) {
        return $false
    }

    $procName = $proc.ProcessName

    # Try graceful stop first
    Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 200

    # Check if still running
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
        # Force kill
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 200
    }

    # Verify killed
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    return (-not $proc)
}

Write-Host "Stopping MachinaOs services..." -ForegroundColor Cyan
Write-Host "Platform: Windows"
Write-Host "Ports: $($Ports -join ', ')`n"

$allStopped = $true

foreach ($port in $Ports) {
    $portPids = Get-PortProcesses -Port $port

    if ($portPids.Count -eq 0) {
        Write-Host "[OK] Port $port`: Free" -ForegroundColor Green
        continue
    }

    # Collect all PIDs including child processes
    $allPids = @()
    foreach ($pid in $portPids) {
        $allPids += $pid
        $children = Get-ProcessTree -ParentId $pid
        $allPids += $children
    }
    $allPids = $allPids | Select-Object -Unique | Where-Object { $_ -ne 0 }

    $killedPids = @()
    $failedPids = @()

    # Kill all processes (children first, then parents)
    $sortedPids = $allPids | Sort-Object -Descending

    foreach ($pid in $sortedPids) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            $procName = $proc.ProcessName
            $killed = Stop-ProcessSafely -ProcessId $pid
            if ($killed) {
                $killedPids += "$pid ($procName)"
            } else {
                $failedPids += "$pid ($procName)"
            }
        }
    }

    # Verify port is free
    Start-Sleep -Milliseconds 500
    $remainingPids = Get-PortProcesses -Port $port

    if ($remainingPids.Count -eq 0) {
        if ($killedPids.Count -gt 0) {
            Write-Host "[OK] Port $port`: Killed $($killedPids.Count) process(es)" -ForegroundColor Green
            Write-Host "    PIDs: $($killedPids -join ', ')" -ForegroundColor DarkGray
        } else {
            Write-Host "[OK] Port $port`: Free" -ForegroundColor Green
        }
    } else {
        Write-Host "[!!] Port $port`: Warning - still in use" -ForegroundColor Yellow
        if ($killedPids.Count -gt 0) {
            Write-Host "    Killed: $($killedPids -join ', ')" -ForegroundColor DarkGray
        }
        Write-Host "    Still running: $($remainingPids -join ', ')" -ForegroundColor Red
        $allStopped = $false
    }
}

Write-Host ""
if ($allStopped) {
    Write-Host "All services stopped successfully." -ForegroundColor Green
} else {
    Write-Host "Warning: Some ports may still be in use." -ForegroundColor Yellow
    Write-Host "Try running as Administrator or manually kill the processes." -ForegroundColor Yellow
    exit 1
}
