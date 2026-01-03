#!/bin/bash

# Nowa Panel - Installation

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Go to the project root (one level up from bin/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

EXTENSION_UUID="nowa-panel@nowaos"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCHEMA_DIR="$EXTENSION_DIR/schemas"

# Color codes
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "======================================"
echo "Nowa Panel - Installation"
echo "======================================"
echo ""

# Step 1: Disable and remove old installation
if [ -d "$EXTENSION_DIR" ]; then
  gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || true
  rm -rf "$EXTENSION_DIR"
fi

# Step 2: Create directories
mkdir -p "$EXTENSION_DIR"
mkdir -p "$SCHEMA_DIR"

# Step 3: Copy extension files from project root
cp "$PROJECT_ROOT/extension.js" "$EXTENSION_DIR/"
cp "$PROJECT_ROOT/metadata.json" "$EXTENSION_DIR/"
cp "$PROJECT_ROOT/stylesheet.css" "$EXTENSION_DIR/"
cp "$PROJECT_ROOT/prefs.js" "$EXTENSION_DIR/"
cp -r "$PROJECT_ROOT/src" "$EXTENSION_DIR/"

# Step 4: Copy and compile schema
cp "$PROJECT_ROOT/schemas/org.gnome.shell.extensions.nowa-panel.gschema.xml" "$SCHEMA_DIR/"

cd "$SCHEMA_DIR"
glib-compile-schemas . 2>&1

if [ ! -f "gschemas.compiled" ]; then
  echo "Schema compilation failed"
  exit 1
fi

cd - > /dev/null

# Step 5: Verify installation
if [ -f "$EXTENSION_DIR/extension.js" ] && \
   [ -f "$EXTENSION_DIR/metadata.json" ] && \
   [ -f "$EXTENSION_DIR/stylesheet.css" ] && \
   [ -f "$EXTENSION_DIR/prefs.js" ] && \
   [ -f "$SCHEMA_DIR/gschemas.compiled" ]; then
  echo -e "${GREEN}✓${NC} Installation complete"
else
  echo "Installation verification failed"
  exit 1
fi

echo ""
echo "======================================"

# Detect session type
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
  echo ""
  echo "Logout and login to activate"
  echo "Then run: gnome-extensions enable $EXTENSION_UUID"
else
  echo ""
  echo "Restart GNOME Shell (Alt+F2, type 'r', press Enter)"
  read -p "Press Enter to continue..."

  busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting...")' &>/dev/null || {
    echo "Manual restart required (Alt+F2, type 'r', Enter)"
    read -p "Press Enter after restarting..."
  }

  gnome-extensions enable "$EXTENSION_UUID"
  echo -e "${GREEN}✓${NC} Extension enabled"
fi

echo ""
