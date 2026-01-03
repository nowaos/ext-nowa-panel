#!/bin/bash

# Nowa Panel - Uninstall script

EXTENSION_UUID="nowa-panel@nowaos"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo "======================================"
echo "Nowa Panel - Uninstall"
echo "======================================"
echo ""

# Check if extension exists
if [ ! -d "$EXTENSION_DIR" ]; then
  echo "✓ Extension is not installed"
  exit 0
fi

# Disable extension
echo "🔌 Disabling extension..."
gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || true

# Remove extension directory
echo "🗑️  Removing extension files..."
rm -rf "$EXTENSION_DIR"

echo ""
echo "======================================"
echo "✨ Uninstall complete!"
echo "======================================"
echo ""

# Detect if Wayland or X11
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
  echo "⚠️  IMPORTANT - You are using Wayland:"
  echo "Please LOGOUT and LOGIN again for changes to take effect."
else
  echo "⚠️  IMPORTANT - You are using X11:"
  echo "Please restart GNOME Shell (Alt+F2, type 'r', press Enter)"
fi

echo ""
