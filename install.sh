#!/usr/bin/env bash
# MachinaOS Installer
# Prerequisites: Node.js 20+, Python 3.11+
#
# Usage: curl -fsSL https://raw.githubusercontent.com/trohitg/MachinaOS/main/install.sh | bash

set -e

echo "Installing MachinaOS..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js 20+ is required"
  echo "  Install from: https://nodejs.org/"
  exit 1
fi
echo "  Node.js: $(node --version)"

# Check Python
if command -v python3 &> /dev/null; then
  PY=python3
elif command -v python &> /dev/null; then
  PY=python
else
  echo "Error: Python 3.11+ is required"
  echo "  Install from: https://python.org/"
  exit 1
fi
echo "  Python: $($PY --version)"

# Ensure pip is available (use ensurepip if missing)
if ! $PY -m pip --version &> /dev/null; then
  echo "  Installing pip..."
  $PY -m ensurepip --upgrade
fi

# Install uv via pip if not found
if ! command -v uv &> /dev/null; then
  echo "  Installing uv..."
  $PY -m pip install uv
fi
echo "  uv: $(uv --version)"

echo ""

# Install machinaos from npm (includes whatsapp-rpc)
npm install -g machinaos

echo ""
echo "MachinaOS installed successfully!"
echo ""
echo "  Start: machinaos start"
echo "  Open:  http://localhost:3000"
echo ""
