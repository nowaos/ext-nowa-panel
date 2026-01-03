// SPDX-FileCopyrightText: Nowa Desktop Contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import GdkPixbuf from 'gi://GdkPixbuf'

import { Logger } from './Logger.js'

/**
* WallpaperAnalyzer - Single Responsibility: Analyze wallpaper colors and luminance
*
* Based on ElementaryOS WingPanel algorithm with enhanced analysis
*/
export class WallpaperAnalyzer {
  /**
  * Analyzes a wallpaper and determines appropriate panel style
  * @param {string} wallpaperPath - Path to wallpaper file
  * @param {number} luminanceThreshold - Threshold for dark/light detection (0.0-1.0)
  * @param {number} panelHeight - Height of panel for crop (default 32)
  * @returns {object} Analysis result with style recommendation
  */
  static analyze(wallpaperPath, luminanceThreshold = 0.575, panelHeight = 32) {
    try {
      // Tolerance zone: ignore 4px from each edge
      const PADDING = 4

      // Load FULL image (no scaling)
      const fullPixbuf = GdkPixbuf.Pixbuf.new_from_file(wallpaperPath)
      const fullWidth = fullPixbuf.get_width()
      const fullHeight = fullPixbuf.get_height()

      const bgSlice = fullPixbuf.new_subpixbuf(
        PADDING,
        PADDING,
        Math.max(1, fullWidth - (PADDING * 2)),
        Math.max(0, Math.min(panelHeight, fullHeight) - PADDING)
      )

      const analysis = this.#analyzeTopRegion(bgSlice)
      const style = this.#determineStyle(analysis, luminanceThreshold)

      return {
        style,
        ...analysis
      }

    } catch (error) {
      Logger.error(`WallpaperAnalyzer: Failed to analyze - ${error.message}`)
      // Default to dark style on error
      return {
        style: 'dark',
        meanLuminance: 0.5,
        error: error.message
      }
    }
  }

  /**
  * Analyzes the top region of wallpaper
  * @private
  */
  static #analyzeTopRegion(bgSlice) {
    const width = bgSlice.get_width()
    const height = bgSlice.get_height()
    const rowstride = bgSlice.get_rowstride()
    const pixels = bgSlice.get_pixels()
    const hasAlpha = bgSlice.get_has_alpha()
    const channels = hasAlpha ? 4 : 3

    return this.#analyzePixels(pixels, width, height, rowstride, channels)
  }

  /**
  * Analyzes pixels using checkerboard sampling
  * @private
  */
  static #analyzePixels(pixels, width, height, rowstride, channels) {
    let totalLuminosity = 0
    let luminositySquaredSum = 0
    let minLuminosity = 1
    let maxLuminosity = 0
    let sampleCount = 0

    // Track RGB values for darkest and lightest pixels
    let minRGB = { r: 255, g: 255, b: 255 }
    let maxRGB = { r: 0, g: 0, b: 0 }

    // Checkerboard pattern sampling: skip every other line, 4px spacing
    for (let y = 0; y < height; y += 2) {
      const xOffset = (y % 4 === 0) ? 0 : 2  // Alternates: line 0,4,8... → offset 0; line 2,6,10... → offset 2

      for (let x = xOffset; x < width; x += 4) {
        const pixelIndex = y * rowstride + x * channels

        const r = pixels[pixelIndex] / 255
        const g = pixels[pixelIndex + 1] / 255
        const b = pixels[pixelIndex + 2] / 255

        // Calculate relative luminosity (ITU-R BT.709)
        const luminosity = 0.299 * r + 0.587 * g + 0.114 * b

        totalLuminosity += luminosity
        luminositySquaredSum += luminosity * luminosity

        // Track min/max and their RGB values
        if (luminosity < minLuminosity) {
          minLuminosity = luminosity
          minRGB = {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
          }
        }
        if (luminosity > maxLuminosity) {
          maxLuminosity = luminosity
          maxRGB = {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
          }
        }

        sampleCount++
      }
    }

    // Calculate statistics
    const meanLuminance = totalLuminosity / sampleCount
    const variance = (luminositySquaredSum / sampleCount) - (meanLuminance * meanLuminance)
    const luminanceStd = Math.sqrt(Math.max(0, variance))

    return {
      meanLuminance,
      luminanceStd,
      minLuminosity,
      maxLuminosity,
      minRGB,
      maxRGB,
      sampleCount,
      width,
      height
    }
  }

  /**
  * Determines panel style based on analysis
  * @private
  */
  static #determineStyle(analysis, LUMINANCE_THRESHOLD) {
    const STD_THRESHOLD = 45 / 255 // 0.176 (from ElementaryOS)

    const meanLuminance = analysis.meanLuminance
    const luminanceStd = analysis.luminanceStd
    const minColor = analysis.minLuminosity
    const maxColor = analysis.maxLuminosity
    const minRGB = analysis.minRGB
    const maxRGB = analysis.maxRGB

    // Helper functions for logging
    const toHex = (rgb) => {
      const r = rgb.r.toString(16).padStart(2, '0')
      const g = rgb.g.toString(16).padStart(2, '0')
      const b = rgb.b.toString(16).padStart(2, '0')
      return `#${r}${g}${b}`.toUpperCase()
    }

    const colorSquare = (rgb) => {
      return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m  \x1b[0m`
    }

    // Log analysis
    Logger.log('=== WALLPAPER ANALYSIS ===')
    Logger.log(`sample: ${analysis.width}x${analysis.height} (${analysis.sampleCount} pixels)`)
    Logger.log(`mean_luminance: ${meanLuminance.toFixed(3)}`)
    Logger.log(`std: ${luminanceStd.toFixed(3)}`)
    Logger.log(`darkest_color: ${minColor.toFixed(3)} (${colorSquare(minRGB)} ${toHex(minRGB)})`)
    Logger.log(`lightest_color: ${maxColor.toFixed(3)} (${colorSquare(maxRGB)} ${toHex(maxRGB)})`)

    // STEP 1: Is background dark or light?
    const isBgDark = meanLuminance < LUMINANCE_THRESHOLD
    Logger.log(`is_bg_dark: ${isBgDark} (threshold: ${LUMINANCE_THRESHOLD.toFixed(3)})`)

    // STEP 2: Is background busy (has patterns/textures)?
    const highVariance = luminanceStd > STD_THRESHOLD
    const nearBoundary = (meanLuminance < LUMINANCE_THRESHOLD &&
      meanLuminance + 1.645 * luminanceStd > LUMINANCE_THRESHOLD)

      // High contrast range indicates areas with very different luminance
      // (e.g., bright sky with dark tree in corner where icons are)
      const range = maxColor - minColor
      const highContrast = range > 0.5

      const isBusy = highVariance || nearBoundary || highContrast

      Logger.log(`is_busy: ${isBusy} (high_variance: ${highVariance}, near_boundary: ${nearBoundary}, high_contrast: ${highContrast}, range: ${range.toFixed(3)})`)

      // STEP 3: Determine panel state
      let state
      let description

      if (isBgDark) {
        // Dark background -> white text
        if (isBusy) {
          state = 'translucent-dark'
          description = 'dark panel + white text'
        } else {
          state = 'dark'
          description = 'transparent + white text'
        }
      } else {
        // Light background -> black text
        if (isBusy) {
          state = 'translucent-light'
          description = 'light panel + black text'
        } else {
          state = 'light'
          description = 'transparent + black text'
        }
      }

      Logger.log(`=== RESULT: ${state} (${description}) ===`)

      return state
    }
  }
