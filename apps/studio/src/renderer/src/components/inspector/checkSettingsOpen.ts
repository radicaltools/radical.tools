// ─── Inspector settings: open or not ─────────────────────────────────────────────
//
// The open model's check.json settings (goals, rules, test files) are a
// dialog opened from the Settings menu, from the Inspector panel's links to
// the goals and the rules, and from a link to the Inspector's Settings tab
// of before (CheckSettingsDialog). Kept apart so the route can open it.

import { create } from 'zustand'

export const useCheckSettingsOpen = create<{ open: boolean }>(() => ({ open: false }))

export function openCheckSettings(): void {
  useCheckSettingsOpen.setState({ open: true })
}

export function closeCheckSettings(): void {
  useCheckSettingsOpen.setState({ open: false })
}
