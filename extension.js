// SPDX-FileCopyrightText: Nowa Panel Contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'

import { AdaptivePanel } from './src/modules/AdaptivePanel.js'
import { Logger } from './src/services/Logger.js'

/**
 * Nowa Panel - Adaptive top panel based on wallpaper analysis
 *
 * Automatically adjusts panel appearance based on:
 * - Wallpaper luminance (dark/light detection)
 * - Window state (maximized mode)
 * - Color scheme changes
 */
export default class NowaPanelExtension extends Extension {
  #adaptivePanel = null

  enable () {
    Logger.log('Nowa Panel extension enabling...')

    const settings = this.getSettings('org.gnome.shell.extensions.nowa-panel')

    // Initialize Adaptive Panel
    this.#adaptivePanel = new AdaptivePanel(settings)
    this.#adaptivePanel.enable()

    Logger.log('Nowa Panel extension enabled')
  }

  disable () {
    Logger.log('Nowa Panel extension disabling...')

    // Disable modules
    if (this.#adaptivePanel) {
      this.#adaptivePanel.disable()
      this.#adaptivePanel = null
    }

    Logger.log('Nowa Panel extension disabled')
  }
}
