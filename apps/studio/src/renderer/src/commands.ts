// ─── Commands ────────────────────────────────────────────────────────────────
//
// What `>` in Quick Search lists: the actions of the toolbar, the activity
// rail and the canvas, as VS Code's command palette. Each part of the app
// registers the commands it runs (useRegisterCommands) while it is shown; a
// command whose `when` says no is not listed.

import { useEffect } from 'react'
import { create } from 'zustand'

export interface Command {
  id: string
  title: string
  /** Where its button is: Perspective, Edit, Canvas, Export… */
  group: string
  /** Its shortcut, as the button's tooltip writes it. */
  keys?: string
  run: () => void
  /** Whether it applies now; listed only then. */
  when?: () => boolean
}

export const useCommands = create<{ owners: Record<string, Command[]> }>(() => ({ owners: {} }))

/** Registers `owner`'s commands while it is mounted, built again when one
 *  of `deps` changes. */
export function useRegisterCommands(owner: string, build: () => Command[], deps: unknown[]): void {
  useEffect(() => {
    useCommands.setState((s) => ({ owners: { ...s.owners, [owner]: build() } }))
    return () => useCommands.setState((s) => {
      const owners = { ...s.owners }
      delete owners[owner]
      return { owners }
    })
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/** The commands that apply now, in the order they were registered. */
export function availableCommands(): Command[] {
  return Object.values(useCommands.getState().owners).flat().filter((c) => !c.when || c.when())
}
