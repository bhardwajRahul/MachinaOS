#!/usr/bin/env bash
# MachinaOS Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.sh | bash
#
# This script installs MachinaOS and its dependencies:
# - Node.js 18+ (if not installed)
# - Python 3.11+ (if not installed)
# - uv (Python package manager)
# - Go 1.21+ (for WhatsApp service)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/trohitg/MachinaOS.git"
INSTALL_DIR="${MACHINAOS_HOME:-$HOME/.machinaos}"
MIN_NODE_VERSION=18
MIN_PYTHON_VERSION="3.11"
MIN_GO_VERSION="1.21"

# Logging functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Banner
echo -e "${CYAN}"
echo "  __  __            _     _             ___  ____  "
echo " |  \/  | __ _  ___| |__ (_)_ __   __ _/ _ \/ ___| "
echo " | |\/| |/ _\` |/ __| '_ \| | '_ \ / _\` | | | \___ \\ "
echo " | |  | | (_| | (__| | | | | | | | (_| | |_| |___) |"
echo " |_|  |_|\__,_|\___|_| |_|_|_| |_|\__,_|\___/|____/ "
echo -e "${NC}"
echo "Open-source workflow automation with AI agents"
echo ""

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="linux";;
        Darwin*)    OS="macos";;
        MINGW*|MSYS*|CYGWIN*) OS="windows";;
        *)          error "Unsupported operating system: $(uname -s)";;
    esac

    # Detect architecture
    case "$(uname -m)" in
        x86_64|amd64) ARCH="x64";;
        arm64|aarch64) ARCH="arm64";;
        *)            error "Unsupported architecture: $(uname -m)";;
    esac

    info "Detected: $OS ($ARCH)"
}

# Check if command exists
has_cmd() {
    command -v "$1" &> /dev/null
}

# Get version number from string
get_version() {
    echo "$1" | grep -oE '[0-9]+\.[0-9]+' | head -1
}

# Compare versions (returns 0 if $1 >= $2)
version_gte() {
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# =============================================================================
# Dependency Checks and Installation
# =============================================================================

check_node() {
    if has_cmd node; then
        NODE_VERSION=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
        if [ "$NODE_MAJOR" -ge "$MIN_NODE_VERSION" ]; then
            success "Node.js v$NODE_VERSION"
            return 0
        else
            warn "Node.js v$NODE_VERSION is too old (need v$MIN_NODE_VERSION+)"
        fi
    fi
    return 1
}

install_node() {
    info "Installing Node.js..."

    if [ "$OS" = "macos" ]; then
        if has_cmd brew; then
            brew install node@20
        else
            error "Please install Homebrew first: https://brew.sh/"
        fi
    elif [ "$OS" = "linux" ]; then
        # Use NodeSource for latest Node.js
        if has_cmd curl; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            error "curl is required. Install with: sudo apt install curl"
        fi
    fi

    check_node || error "Failed to install Node.js"
}

check_python() {
    local py_cmd=""

    # Try python3 first, then python
    for cmd in python3 python; do
        if has_cmd "$cmd"; then
            PY_VERSION=$($cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
            if version_gte "$PY_VERSION" "$MIN_PYTHON_VERSION"; then
                success "Python $PY_VERSION ($cmd)"
                PYTHON_CMD="$cmd"
                return 0
            fi
        fi
    done

    warn "Python $MIN_PYTHON_VERSION+ not found"
    return 1
}

install_python() {
    info "Installing Python..."

    if [ "$OS" = "macos" ]; then
        if has_cmd brew; then
            brew install python@3.12
        else
            error "Please install Homebrew first: https://brew.sh/"
        fi
    elif [ "$OS" = "linux" ]; then
        if has_cmd apt; then
            sudo apt update
            sudo apt install -y python3.12 python3.12-venv python3-pip
        elif has_cmd dnf; then
            sudo dnf install -y python3.12
        elif has_cmd pacman; then
            sudo pacman -S --noconfirm python
        else
            error "Please install Python manually from https://python.org/"
        fi
    fi

    check_python || error "Failed to install Python"
}

check_uv() {
    if has_cmd uv; then
        UV_VERSION=$(uv --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        success "uv $UV_VERSION"
        return 0
    fi
    return 1
}

install_uv() {
    info "Installing uv (Python package manager)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh

    # Add to PATH for current session
    export PATH="$HOME/.local/bin:$PATH"

    check_uv || error "Failed to install uv"
}

check_go() {
    if has_cmd go; then
        GO_VERSION=$(go version | grep -oE 'go[0-9]+\.[0-9]+' | sed 's/go//')
        if version_gte "$GO_VERSION" "$MIN_GO_VERSION"; then
            success "Go $GO_VERSION"
            return 0
        else
            warn "Go $GO_VERSION is too old (need $MIN_GO_VERSION+)"
        fi
    fi
    return 1
}

install_go() {
    info "Installing Go..."

    if [ "$OS" = "macos" ]; then
        if has_cmd brew; then
            brew install go
        else
            error "Please install Homebrew first: https://brew.sh/"
        fi
    elif [ "$OS" = "linux" ]; then
        if has_cmd apt; then
            sudo apt update
            sudo apt install -y golang-go
        elif has_cmd dnf; then
            sudo dnf install -y golang
        elif has_cmd pacman; then
            sudo pacman -S --noconfirm go
        else
            # Manual install
            GO_TAR="go1.21.13.linux-${ARCH}.tar.gz"
            curl -LO "https://go.dev/dl/$GO_TAR"
            sudo rm -rf /usr/local/go
            sudo tar -C /usr/local -xzf "$GO_TAR"
            rm "$GO_TAR"
            export PATH="$PATH:/usr/local/go/bin"
        fi
    fi

    check_go || error "Failed to install Go"
}

check_git() {
    if has_cmd git; then
        GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+')
        success "Git $GIT_VERSION"
        return 0
    fi
    return 1
}

install_git() {
    info "Installing Git..."

    if [ "$OS" = "macos" ]; then
        xcode-select --install 2>/dev/null || true
    elif [ "$OS" = "linux" ]; then
        if has_cmd apt; then
            sudo apt update && sudo apt install -y git
        elif has_cmd dnf; then
            sudo dnf install -y git
        elif has_cmd pacman; then
            sudo pacman -S --noconfirm git
        fi
    fi

    check_git || error "Failed to install Git"
}

# =============================================================================
# MachinaOS Installation
# =============================================================================

install_machinaos() {
    echo ""
    info "Installing MachinaOS to $INSTALL_DIR..."

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Clone or update repository
    if [ -d "$INSTALL_DIR/.git" ]; then
        info "Updating existing installation..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        info "Cloning repository..."
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    # Run build
    info "Building MachinaOS..."
    npm run build

    # Create symlink for global command
    info "Creating global command..."

    SYMLINK_DIR="$HOME/.local/bin"
    mkdir -p "$SYMLINK_DIR"

    # Remove old symlink if exists
    rm -f "$SYMLINK_DIR/machinaos"

    # Create new symlink
    ln -s "$INSTALL_DIR/bin/cli.js" "$SYMLINK_DIR/machinaos"
    chmod +x "$INSTALL_DIR/bin/cli.js"

    # Check if PATH includes ~/.local/bin
    if [[ ":$PATH:" != *":$SYMLINK_DIR:"* ]]; then
        warn "Add $SYMLINK_DIR to your PATH:"
        echo ""
        echo "  # Add to ~/.bashrc or ~/.zshrc:"
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
    fi
}

# =============================================================================
# Main Installation Flow
# =============================================================================

main() {
    detect_os

    echo ""
    info "Checking dependencies..."
    echo ""

    # Check and install dependencies
    check_git || install_git
    check_node || install_node
    check_python || install_python
    check_uv || install_uv
    check_go || install_go

    # Install MachinaOS
    install_machinaos

    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  MachinaOS installed successfully!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "  Start MachinaOS:"
    echo "    cd $INSTALL_DIR && npm run start"
    echo ""
    echo "  Or use the global command (after adding to PATH):"
    echo "    machinaos start"
    echo ""
    echo "  Open in browser:"
    echo "    http://localhost:3000"
    echo ""
    echo "  Documentation:"
    echo "    https://github.com/trohitg/MachinaOS"
    echo ""
}

# Run main
main "$@"
