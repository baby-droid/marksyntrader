---
name: Unified Settings panel
description: Single settings entry point pattern after removing the duplicate SettingsModal
---

The app previously had two separate Settings UIs: a header/mobile-menu "Settings"
MenuItem that opened a SettingsModal component, and a separate floating gear-icon
SettingsPanel (bottom corner) with its own theme toggle plus several fake/decorative
toggles (Fast execution, Trade alerts, Show digit %, Cursor tracker) that were never
wired to real state.

Consolidated to one surface: SettingsPanel is now opened from every entry point
(floating gear button, desktop header MenuItem, mobile menu item) via a single
shared observable, ui_store.is_settings_panel_open / setSettingsPanelOpen(bool).
SettingsPanel's content was updated to show only real, functional settings
(theme toggle, display currency USD/KSH via currency-display.ts, account login ID)
plus the existing app-wide Navigate tab. SettingsModal was deleted as dead code.

**Why:** two divergent settings implementations invite drift and confuse users
about which "Settings" is authoritative; decorative toggles that do nothing are
worse than not having them.

**How to apply:** any new settings option should be added to SettingsPanel
(src/components/settings-panel/index.tsx), not a new modal. To open it
programmatically from anywhere with store access, call
store.ui.setSettingsPanelOpen(true).
