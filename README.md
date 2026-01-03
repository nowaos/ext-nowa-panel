# Nowa Panel

Adaptive top panel for GNOME Shell 48 with automatic styling based on wallpaper analysis.

## Features

### Adaptive Panel Styling

Automatically adjusts panel appearance based on wallpaper analysis:

- **Dark mode**: White text/icons on dark wallpapers
- **Light mode**: Dark text/icons on light wallpapers  
- **Translucent modes**: Semi-transparent panel with blur effect for busy wallpapers
- **Maximized mode**: Solid black panel when window is maximized

### Intelligent Wallpaper Analysis

- Analyzes top portion of wallpaper for accurate detection
- Configurable luminance threshold
- Optimized sampling for performance
- Supports both light and dark mode wallpapers
- Real-time updates on wallpaper changes

### Manual Control

Override automatic detection with manual panel modes:
- Dark
- Light
- Translucent Dark
- Translucent Light

## Installation

```bash
chmod +x bin/install.sh
./bin/install.sh
```

## Configuration

Open preferences:
```bash
gnome-extensions prefs nowa-panel@nowaos
```

### Settings

**Panel Mode**: Choose between automatic or manual styling

**Luminance Threshold**: Adjust sensitivity for dark/light detection (0.0 - 1.0)
- Lower values: More wallpapers detected as "dark"
- Higher values: More wallpapers detected as "light"

## Development

### Debug Logs
```bash
./bin/debug.sh
```

Filter by module:
```bash
./bin/debug.sh -m "Adaptive Panel"
```

### Uninstall
```bash
./bin/uninstall.sh
```

## Code Style

This project follows StandardJS style:
- 2 spaces for indentation
- No semicolons
- Single quotes

## License

[GPL-3.0-or-later](LICENSE)

Copyright (c) 2024-present, Nowa Panel Contributors

## Credits

Wallpaper analysis algorithm inspired by ElementaryOS WingPanel.
