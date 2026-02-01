# MachinaOS Installer for Windows
# Usage: iwr -useb https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.ps1 | iex
#
# This script installs MachinaOS and its dependencies:
# - Node.js 18+ (via winget/choco)
# - Python 3.11+ (via winget/choco)
# - uv (Python package manager)
# - Go 1.21+ (for WhatsApp service)

$ErrorActionPreference = "Stop"

# Configuration
$REPO_URL = "https://github.com/trohitg/MachinaOS.git"
$INSTALL_DIR = if ($env:MACHINAOS_HOME) { $env:MACHINAOS_HOME } else { "$env:USERPROFILE\.machinaos" }
$MIN_NODE_VERSION = 18
$MIN_PYTHON_VERSION = "3.11"
$MIN_GO_VERSION = "1.21"

# Colors
function Write-Color {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Info { Write-Color "[INFO] $args" "Cyan" }
function Success { Write-Color "[OK] $args" "Green" }
function Warn { Write-Color "[WARN] $args" "Yellow" }
function Error-Exit { Write-Color "[ERROR] $args" "Red"; exit 1 }

# Banner
Write-Host ""
Write-Color "  __  __            _     _             ___  ____  " "Cyan"
Write-Color " |  \/  | __ _  ___| |__ (_)_ __   __ _/ _ \/ ___| " "Cyan"
Write-Color " | |\/| |/ _`` |/ __| '_ \| | '_ \ / _`` | | | \___ \ " "Cyan"
Write-Color " | |  | | (_| | (__| | | | | | | | (_| | |_| |___) |" "Cyan"
Write-Color " |_|  |_|\__,_|\___|_| |_|_|_| |_|\__,_|\___/|____/ " "Cyan"
Write-Host ""
Write-Host "Open-source workflow automation with AI agents"
Write-Host ""

# Check if command exists
function Has-Command {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Get package manager
function Get-PackageManager {
    if (Has-Command "winget") { return "winget" }
    if (Has-Command "choco") { return "choco" }
    return $null
}

# =============================================================================
# Dependency Checks and Installation
# =============================================================================

function Check-Node {
    if (Has-Command "node") {
        $version = (node --version) -replace "v", ""
        $major = [int]($version.Split(".")[0])
        if ($major -ge $MIN_NODE_VERSION) {
            Success "Node.js v$version"
            return $true
        }
        Warn "Node.js v$version is too old (need v$MIN_NODE_VERSION+)"
    }
    return $false
}

function Install-Node {
    Info "Installing Node.js..."
    $pm = Get-PackageManager

    switch ($pm) {
        "winget" {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        }
        "choco" {
            choco install nodejs-lts -y
        }
        default {
            Error-Exit "Please install winget or chocolatey, or install Node.js manually from https://nodejs.org/"
        }
    }

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    if (-not (Check-Node)) {
        Error-Exit "Failed to install Node.js. Please install manually and restart PowerShell."
    }
}

function Check-Python {
    foreach ($cmd in @("python", "python3")) {
        if (Has-Command $cmd) {
            $version = & $cmd --version 2>&1 | Select-String -Pattern "\d+\.\d+" | ForEach-Object { $_.Matches.Value }
            if ($version -ge $MIN_PYTHON_VERSION) {
                Success "Python $version ($cmd)"
                $script:PYTHON_CMD = $cmd
                return $true
            }
        }
    }
    Warn "Python $MIN_PYTHON_VERSION+ not found"
    return $false
}

function Install-Python {
    Info "Installing Python..."
    $pm = Get-PackageManager

    switch ($pm) {
        "winget" {
            winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        }
        "choco" {
            choco install python312 -y
        }
        default {
            Error-Exit "Please install winget or chocolatey, or install Python manually from https://python.org/"
        }
    }

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    if (-not (Check-Python)) {
        Error-Exit "Failed to install Python. Please install manually and restart PowerShell."
    }
}

function Check-Uv {
    if (Has-Command "uv") {
        $version = (uv --version) -replace "uv ", ""
        Success "uv $version"
        return $true
    }
    return $false
}

function Install-Uv {
    Info "Installing uv (Python package manager)..."
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression

    # Add to PATH for current session
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"

    if (-not (Check-Uv)) {
        Error-Exit "Failed to install uv"
    }
}

function Check-Go {
    if (Has-Command "go") {
        $versionOutput = go version
        if ($versionOutput -match "go(\d+\.\d+)") {
            $version = $Matches[1]
            if ($version -ge $MIN_GO_VERSION) {
                Success "Go $version"
                return $true
            }
            Warn "Go $version is too old (need $MIN_GO_VERSION+)"
        }
    }
    return $false
}

function Install-Go {
    Info "Installing Go..."
    $pm = Get-PackageManager

    switch ($pm) {
        "winget" {
            winget install GoLang.Go --accept-package-agreements --accept-source-agreements
        }
        "choco" {
            choco install golang -y
        }
        default {
            Error-Exit "Please install winget or chocolatey, or install Go manually from https://go.dev/dl/"
        }
    }

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    if (-not (Check-Go)) {
        Error-Exit "Failed to install Go. Please install manually and restart PowerShell."
    }
}

function Check-Git {
    if (Has-Command "git") {
        $version = (git --version) -replace "git version ", ""
        Success "Git $version"
        return $true
    }
    return $false
}

function Install-Git {
    Info "Installing Git..."
    $pm = Get-PackageManager

    switch ($pm) {
        "winget" {
            winget install Git.Git --accept-package-agreements --accept-source-agreements
        }
        "choco" {
            choco install git -y
        }
        default {
            Error-Exit "Please install winget or chocolatey, or install Git manually from https://git-scm.com/"
        }
    }

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    if (-not (Check-Git)) {
        Error-Exit "Failed to install Git. Please install manually and restart PowerShell."
    }
}

# =============================================================================
# MachinaOS Installation
# =============================================================================

function Install-MachinaOS {
    Write-Host ""
    Info "Installing MachinaOS to $INSTALL_DIR..."

    # Create install directory
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }

    # Clone or update repository
    if (Test-Path "$INSTALL_DIR\.git") {
        Info "Updating existing installation..."
        Push-Location $INSTALL_DIR
        git pull origin main
    } else {
        Info "Cloning repository..."
        git clone $REPO_URL $INSTALL_DIR
        Push-Location $INSTALL_DIR
    }

    # Run build
    Info "Building MachinaOS..."
    npm run build

    Pop-Location

    # Add to PATH suggestion
    $binPath = "$INSTALL_DIR\bin"
    if ($env:Path -notlike "*$binPath*") {
        Warn "Add MachinaOS to your PATH:"
        Write-Host ""
        Write-Host "  # Run this command to add to PATH permanently:"
        Write-Host "  [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$binPath', 'User')"
        Write-Host ""
    }
}

# =============================================================================
# Main Installation Flow
# =============================================================================

function Main {
    Write-Host ""
    Info "Checking dependencies..."
    Write-Host ""

    # Check and install dependencies
    if (-not (Check-Git)) { Install-Git }
    if (-not (Check-Node)) { Install-Node }
    if (-not (Check-Python)) { Install-Python }
    if (-not (Check-Uv)) { Install-Uv }
    if (-not (Check-Go)) { Install-Go }

    # Install MachinaOS
    Install-MachinaOS

    Write-Host ""
    Write-Color "============================================" "Green"
    Write-Color "  MachinaOS installed successfully!" "Green"
    Write-Color "============================================" "Green"
    Write-Host ""
    Write-Host "  Start MachinaOS:"
    Write-Host "    cd $INSTALL_DIR"
    Write-Host "    npm run start"
    Write-Host ""
    Write-Host "  Or use the CLI:"
    Write-Host "    node $INSTALL_DIR\bin\cli.js start"
    Write-Host ""
    Write-Host "  Open in browser:"
    Write-Host "    http://localhost:3000"
    Write-Host ""
    Write-Host "  Documentation:"
    Write-Host "    https://github.com/trohitg/MachinaOS"
    Write-Host ""
}

# Run main
Main
