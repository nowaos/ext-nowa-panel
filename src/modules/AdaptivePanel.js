// SPDX-FileCopyrightText: Nowa Desktop Contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib'
import Gio from 'gi://Gio'
import St from 'gi://St'
import Clutter from 'gi://Clutter'
import Meta from 'gi://Meta'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'

import { _BaseModule } from './_BaseModule.js'
import { Logger } from '../services/Logger.js'
import { WallpaperAnalyzer } from '../services/WallpaperAnalyzer.js'

const BACKGROUND_SCHEMA = 'org.gnome.desktop.background'
const BACKGROUND_KEY = 'picture-uri'
const BACKGROUND_KEY_DARK = 'picture-uri-dark'
const INTERFACE_SCHEMA = 'org.gnome.desktop.interface'

/**
* Adaptive Panel - adaptive panel based on wallpaper analysis and window state
*/
export class AdaptivePanel extends _BaseModule {
  #settings
  #backgroundSettings
  #interfaceSettings
  #panel
  #currentStyle = null
  #fileMonitor = null
  #windowSignalIds = null
  #actorSignalIds = null
  #isWindowMaximized = false
  #overviewShowingConnection = null
  #overviewHidingConnection = null
  #screenShieldConnection = null
  #backgroundSignals = []
  #settingsConnections = []

  constructor (settings) {
    super()

    this.#settings = settings
    this.#backgroundSettings = new Gio.Settings({ schema: BACKGROUND_SCHEMA })
    this.#interfaceSettings = new Gio.Settings({ schema: INTERFACE_SCHEMA })
    this.#panel = Main.panel
  }

  enable () {
    super.enable()

    // Monitor background changes
    this.#backgroundSignals.push(
      this.#backgroundSettings.connect(`changed::${BACKGROUND_KEY}`, () => {
        Logger.debug(this.name, 'Background changed')
        this.#onWallpaperChanged()
      })
    )

    this.#backgroundSignals.push(
      this.#backgroundSettings.connect(`changed::${BACKGROUND_KEY_DARK}`, () => {
        Logger.debug(this.name, 'Dark background changed')
        this.#onWallpaperChanged()
      })
    )

    // Monitor color scheme changes (light/dark mode)
    this.#backgroundSignals.push(
      this.#interfaceSettings.connect('changed::color-scheme', () => {
        Logger.debug(this.name, 'Color scheme changed')
        this.#onWallpaperChanged()
      })
    )

    // Monitor panel mode changes
    this.#settingsConnections.push(
      this.#settings.connect('changed::panel-mode', () => {
        Logger.debug(this.name, 'Panel mode changed')
        this.#onWallpaperChanged()
      })
    )

    // Monitor luminance threshold changes
    this.#settingsConnections.push(
      this.#settings.connect('changed::luminance-threshold', () => {
        Logger.debug(this.name, 'Luminance threshold changed')
        this.#onWallpaperChanged()
      })
    )

    // Setup file monitor
    this.#setupFileMonitor()


    // Monitor Overview to hide/show panel with animations
    this.#overviewShowingConnection = Main.overview.connect('showing', () => {
      // Move panel off-screen (above viewport)
      const panelHeight = this.#panel.height
      this.#panel.translation_y = -panelHeight
      this.#panel.opacity = 0
    })

    this.#overviewHidingConnection = Main.overview.connect('hiding', () => {
      this.#panel.translation_y = -6
      this.#panel.opacity = 0

      this.#panel.ease({
        translation_y: 0,
        opacity: 255,
        duration: 200,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
          if (this.#currentStyle) {
            const savedStyle = this.#currentStyle
            this.#currentStyle = null
            this.#applyStyle(savedStyle)
          }
        }
      })
    })

    // Monitor screen lock/unlock
    this.#screenShieldConnection = Main.screenShield.connect('active-changed', () => {
      if (!Main.screenShield.locked) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
          this.#currentStyle = null
          this.#onWallpaperChanged()
          return GLib.SOURCE_REMOVE
        })
      }
    })

    // Setup window tracking
    this.#setupWindowTracking()

    // Initial wallpaper check
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this.#onWallpaperChanged()
      return GLib.SOURCE_REMOVE
    })

    // Initial maximized state check
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      this.#updateMaximizedState()
      return GLib.SOURCE_REMOVE
    })
  }

  disable () {
    super.disable()

    // Cancel file monitor
    if (this.#fileMonitor) {
      this.#fileMonitor.cancel()
      this.#fileMonitor = null
    }

    // Disconnect overview signals
    if (this.#overviewShowingConnection) {
      Main.overview.disconnect(this.#overviewShowingConnection)
      this.#overviewShowingConnection = null
    }

    if (this.#overviewHidingConnection) {
      Main.overview.disconnect(this.#overviewHidingConnection)
      this.#overviewHidingConnection = null
    }

    // Disconnect screen shield signal
    if (this.#screenShieldConnection) {
      Main.screenShield.disconnect(this.#screenShieldConnection)
      this.#screenShieldConnection = null
    }

    // Remove background signals
    this.#backgroundSignals.forEach(id => this.#backgroundSettings.disconnect(id))
    this.#backgroundSignals = []

    // Remove settings signals
    this.#settingsConnections.forEach(id => this.#settings.disconnect(id))
    this.#settingsConnections = []

    // Disconnect window tracking
    this.#cleanupWindowTracking()

    // Restore original style
    this.#restoreOriginalStyle()
  }

  #setupFileMonitor () {
    try {
      const wallpaperPath = this.#getWallpaperPath()
      if (wallpaperPath && wallpaperPath !== '') {
        const file = Gio.File.new_for_path(wallpaperPath)
        this.#fileMonitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null)
        this.#fileMonitor.connect('changed', (monitor, file, otherFile, eventType) => {
          if (
            eventType === Gio.FileMonitorEvent.CHANGED ||
            eventType === Gio.FileMonitorEvent.CREATED ||
            eventType === Gio.FileMonitorEvent.ATTRIBUTE_CHANGED
          ) {
            Logger.debug(this.name, 'Wallpaper file changed')
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
              this.#onWallpaperChanged()
              return GLib.SOURCE_REMOVE
            })
          }
        })
        Logger.debug(this.name, `File monitor setup for ${wallpaperPath}`)
      }
    } catch (e) {
      Logger.error(`Failed to setup file monitor: ${e.message}`)
    }
  }

  #setupWindowTracking () {
    this.#windowSignalIds = new Map()
    this.#actorSignalIds = new Map()

    const tracker = global.display.get_workspace_manager().get_active_workspace()
    const windows = tracker.list_windows()

    windows.forEach(metaWindow => {
      const metaWindowActor = metaWindow.get_compositor_private()
      if (metaWindowActor) {
        this.#onWindowActorAdded(metaWindowActor.get_parent(), metaWindowActor)
      }
    })

    const windowManager = global.window_manager
    global.display.connect('window-created', (display, metaWindow) => {
      const metaWindowActor = metaWindow.get_compositor_private()
      if (metaWindowActor) {
        this.#onWindowActorAdded(metaWindowActor.get_parent(), metaWindowActor)
      }
    })
  }

  #cleanupWindowTracking () {
    if (this.#windowSignalIds) {
      for (let [metaWindow, signalIds] of this.#windowSignalIds.entries()) {
        signalIds.forEach(signalId => {
          try {
            metaWindow.disconnect(signalId)
          } catch (e) {}
        })
      }
      this.#windowSignalIds.clear()
      this.#windowSignalIds = null
    }

    if (this.#actorSignalIds) {
      for (let [actor, signalId] of this.#actorSignalIds.entries()) {
        try {
          actor.disconnect(signalId)
        } catch (e) {}
      }
      this.#actorSignalIds.clear()
      this.#actorSignalIds = null
    }
  }

  #onWindowActorAdded (container, metaWindowActor) {
    if (!this.#windowSignalIds) {
      this.#windowSignalIds = new Map()
    }
    if (!this.#actorSignalIds) {
      this.#actorSignalIds = new Map()
    }

    const metaWindow = metaWindowActor.get_meta_window()

    if (this.#windowSignalIds.has(metaWindow)) {
      return
    }

    const signalIds = []

    signalIds.push(metaWindow.connect('size-changed', () => {
      this.#updateMaximizedState()
    }))

    this.#windowSignalIds.set(metaWindow, signalIds)

    const actorSignalId = metaWindowActor.connect('destroy', () => {
      this.#onWindowActorRemoved(metaWindow, metaWindowActor)
    })
    this.#actorSignalIds.set(metaWindowActor, actorSignalId)
  }

  #onWindowActorRemoved (metaWindow, metaWindowActor) {
    if (this.#windowSignalIds && this.#windowSignalIds.has(metaWindow)) {
      const signalIds = this.#windowSignalIds.get(metaWindow)
      signalIds.forEach(signalId => {
        try {
          metaWindow.disconnect(signalId)
        } catch (e) {}
      })
      this.#windowSignalIds.delete(metaWindow)
    }

    if (this.#actorSignalIds && this.#actorSignalIds.has(metaWindowActor)) {
      this.#actorSignalIds.delete(metaWindowActor)
    }

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this.#updateMaximizedState()
      return GLib.SOURCE_REMOVE
    })
  }

  #updateMaximizedState () {
    const state = this.#detectMaximizedWindow()
    const wasMaximized = this.#isWindowMaximized
    this.#isWindowMaximized = state

    if (wasMaximized !== state) {
      Logger.debug(this.name, `Maximized state changed: ${state}`)
      this.#onWallpaperChanged()
    }
  }

  #detectMaximizedWindow () {
    const workspace = global.workspace_manager.get_active_workspace()
    const windows = workspace.list_windows()

    for (let window of windows) {
      if (window.is_hidden() || window.minimized) {
        continue
      }

      if (!window.get_compositor_private()) {
        continue
      }

      if (window.window_type !== Meta.WindowType.NORMAL) {
        continue
      }

      // Use Meta's native maximized detection
      // Returns 3 (Meta.MaximizeFlags.BOTH) when fully maximized
      if (window.get_maximized() === Meta.MaximizeFlags.BOTH) {
        Logger.debug(this.name, `Found maximized window: ${window.get_title()}`)
        return true
      }
    }

    return false
  }

  #getWallpaperPath () {
    try {
      // Detect current color scheme
      const colorScheme = this.#interfaceSettings.get_string('color-scheme')
      const isDarkMode = colorScheme === 'prefer-dark'

      // Use appropriate wallpaper (dark or light)
      const wallpaperKey = isDarkMode ? BACKGROUND_KEY_DARK : BACKGROUND_KEY
      let uri = this.#backgroundSettings.get_string(wallpaperKey)

      Logger.debug(this.name, `Color scheme: ${colorScheme}, using ${wallpaperKey}`)
      Logger.debug(this.name, `Raw URI: ${uri}`)

      // Remove file:// prefix
      if (uri.startsWith('file://')) {
        uri = uri.substring(7)
      }

      // Decode URL
      uri = decodeURIComponent(uri)

      return uri
    } catch (e) {
      Logger.error(`Failed to get wallpaper path: ${e.message}`)
    }
    return null
  }

  #onWallpaperChanged () {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      const panelMode = this.#settings.get_string('panel-mode')

      if (panelMode !== 'automatic') {
        this.#applyStyle(panelMode)
        return GLib.SOURCE_REMOVE
      }

      if (this.#isWindowMaximized) {
        this.#applyStyle('maximized')
        return GLib.SOURCE_REMOVE
      }

      const wallpaperPath = this.#getWallpaperPath()
      if (!wallpaperPath) {
        this.#applyStyle('light')
        return GLib.SOURCE_REMOVE
      }

      // Update file monitor for new wallpaper
      if (this.#fileMonitor) {
        this.#fileMonitor.cancel()
        this.#fileMonitor = null
      }
      this.#setupFileMonitor()

      // Use WallpaperAnalyzer service with panel height
      const threshold = this.#settings.get_double('luminance-threshold')
      const panelHeight = this.#panel.get_height() || 32
      const result = WallpaperAnalyzer.analyze(wallpaperPath, threshold, panelHeight)

      this.#applyStyle(result.style)

      return GLib.SOURCE_REMOVE
    })
  }

  #applyStyle (style) {
    if (this.#currentStyle === style) {
      return
    }

    Logger.debug(this.name, `Applying style: ${style}`)

    this.#panel.remove_style_class_name('dark')
    this.#panel.remove_style_class_name('light')
    this.#panel.remove_style_class_name('translucent-dark')
    this.#panel.remove_style_class_name('translucent-light')
    this.#panel.remove_style_class_name('maximized')

    if (style === 'maximized') {
      this.#panel.add_style_class_name('maximized')
    } else {
      this.#panel.add_style_class_name(style)
    }

    this.#currentStyle = style
  }

  #restoreOriginalStyle () {
    if (!this.#panel) return

    this.#panel.opacity = 255
    this.#panel.remove_style_class_name('dark')
    this.#panel.remove_style_class_name('light')
    this.#panel.remove_style_class_name('translucent-dark')
    this.#panel.remove_style_class_name('translucent-light')
    this.#panel.remove_style_class_name('maximized')
  }
}
