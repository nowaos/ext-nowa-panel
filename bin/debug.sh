#!/bin/bash

# Nowa Panel - Debug script

EXTENSION_UUID="nowa-panel@nowaos"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
MODULE_FILTER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--module)
      MODULE_FILTER="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: debug.sh [-m MODULE_NAME]"
      echo ""
      echo "Options:"
      echo "  -m, --module MODULE_NAME    Filter logs by module name"
      echo "  -h, --help                  Show this help"
      echo ""
      echo "Examples:"
      echo "  debug.sh                        # Show all logs"
      echo "  debug.sh -m \"Adaptive Panel\"   # Filter specific module"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use -h for help"
      exit 1
      ;;
  esac
done

echo "======================================"
echo "Nowa Panel - Debugger"
echo "======================================"
echo ""

# Check if extension is installed
if [ -d "$EXTENSION_DIR" ]; then
  echo -e "${GREEN}✓ Extension directory exists${NC}"
else
  echo "✗ Extension directory NOT found"
  exit 1
fi

# Check if enabled
if gnome-extensions list --enabled | grep -q "$EXTENSION_UUID"; then
  echo -e "${GREEN}✓ Extension is ENABLED${NC}"
else
  echo "✗ Extension is DISABLED"
  echo "  Run: gnome-extensions enable $EXTENSION_UUID"
  exit 1
fi

# Current wallpaper
WALLPAPER=$(gsettings get org.gnome.desktop.background picture-uri 2>/dev/null || echo "unknown")
echo ""
echo "- Current Wallpaper: $WALLPAPER"

# Show filter info
if [ -n "$MODULE_FILTER" ]; then
  echo -e "- ${YELLOW}Filter: \"$MODULE_FILTER\"${NC}"
fi

echo ""
echo "======================================"
echo "📋 Live Logs (Ctrl+C to stop):"
echo "======================================"
echo ""

# Build grep pattern
if [ -n "$MODULE_FILTER" ]; then
  echo "Looking for 'Nowa Panel [$MODULE_FILTER]' messages..."
  echo ""
  journalctl -f -o cat /usr/bin/gnome-shell 2>/dev/null | grep --line-buffered "Nowa Panel \[$MODULE_FILTER\]"
else
  echo "Looking for 'Nowa Panel' messages..."
  echo ""
  journalctl -f -o cat /usr/bin/gnome-shell 2>/dev/null | grep --line-buffered "Nowa Panel"
fi
