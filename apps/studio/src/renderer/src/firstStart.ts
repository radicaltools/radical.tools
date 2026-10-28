// Whether this start is Studio's first in this browser or desktop app, read
// before anything else runs: the document store sets up a blank model as it
// loads, which would make every start look like a returning one. main.tsx
// imports this module first. A start in VS Code is never a first one (the
// editor sets the theme); a browser Studio was used in before the Setup
// wizard existed (a model, a theme or Studio settings stored) is marked set
// up without seeing it.

import { loadStudioSettings, updateStudioSettings } from '@radical/ui/studioSettings'
import { host } from './platform/host'

function usedBefore(): boolean {
  try {
    if (localStorage.getItem('radical-theme') || localStorage.getItem('radical-studio-settings')) return true
    const index = JSON.parse(localStorage.getItem('radical-docs-index') ?? 'null') as { docs?: unknown[] } | null
    return !!index?.docs?.length
  } catch {
    return false
  }
}

function check(): boolean {
  if (host().kind === 'vscode' || loadStudioSettings().setupDone) return false
  if (usedBefore()) {
    updateStudioSettings({ setupDone: true })
    return false
  }
  return true
}

const FIRST = check()

/** This start opens the Setup wizard. */
export function firstStart(): boolean {
  return FIRST && !loadStudioSettings().setupDone
}
