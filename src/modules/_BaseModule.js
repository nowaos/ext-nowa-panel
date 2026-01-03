// SPDX-FileCopyrightText: Nowa Desktop Contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { Logger } from '../services/Logger.js'

/**
 * Base class for all Nowa Desktop modules
 */
export class _BaseModule {
  enable () {
    Logger.debug(this.name, 'Enabling...')
  }

  disable () {
    Logger.debug(this.name, 'Disabling...')
  }

  get name () {
    return this.constructor.name
  }
}
