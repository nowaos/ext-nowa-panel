// SPDX-FileCopyrightText: Nowa Panel Contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PanelPrefs } from './src/prefs/PanelPrefs.js';

export default class NowaPanelPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings('org.gnome.shell.extensions.nowa-panel');
    
    // Add Panel preferences page
    window.add(PanelPrefs.buildPage(settings));
  }
}
