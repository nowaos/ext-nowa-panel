// SPDX-FileCopyrightText: Nowa Desktop Contributors
// SPDX-License-Identifier: GPL-3.0-or-later

/**
* Centralized logging utility for Nowa Desktop
*/
export class Logger {
  static #prefix = 'Nowa Desktop'

  static log (message) {
    console.log(`${this.#prefix}: ${message}`)
  }

  static error (message) {
    console.error(`${this.#prefix}: ${message}`)
  }

  static debug (section, message) {
    console.log(`${this.#prefix} [${section}]: ${message}`)
  }
}
