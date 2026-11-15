// Whether this start is Studio's first in this browser or desktop app, read
// before anything else runs: the document store sets up a blank model as it
// loads, which would make every start look like a returning one. main.tsx
// imports this module first. A start in VS Code is never a first one (the
// editor sets the theme); a browser Studio was used in before the Setup
// wizard existed (a model, a theme or Studio settings stored) is marked set
// up without seeing it. A first start stores that the wizard waits, so a
// reload or a new tab before it is finished or skipped opens it again.

import { loadStudioSettings, updateStudioSettings, STUDIO_SETTINGS_KEY } from '@radical/ui/studioSettings'
import { host } from './platform/host'

function usedBefore(): boolean {
  try {
    if (localStorage.getItem('radical-theme') || localStorage.getItem(STUDIO_SETTINGS_KEY)) return true
    // The model the store made on the first visit is not the user's.
    const index = JSON.parse(localStorage.getItem('radical-docs-index') ?? 'null') as { docs?: Array<{ seeded?: boolean }> } | null
    return !!index?.docs?.some((d) => !d.seeded)
  } catch {
    return false
  }
}

/** A start before this one opened the wizard, and it was neither finished
 *  nor skipped: the settings say `setupDone: false`. (Settings stored before
 *  the wizard existed have no `setupDone`.) Every choice in the wizard is
 *  stored at once, and a reload took them for a returning user's. */
function setupWaits(): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(STUDIO_SETTINGS_KEY) ?? 'null') as { setupDone?: unknown } | null
    return stored?.setupDone === false
  } catch {
    return false
  }
}

function check(): boolean {
  if (host().kind === 'vscode' || loadStudioSettings().setupDone) return false
  if (setupWaits()) return true
  if (usedBefore()) {
    updateStudioSettings({ setupDone: true })
    return false
  }
  updateStudioSettings({ setupDone: false })
  return true
}

const FIRST = check()

/** This start opens the Setup wizard. */
export function firstStart(): boolean {
  return FIRST && !loadStudioSettings().setupDone
}
