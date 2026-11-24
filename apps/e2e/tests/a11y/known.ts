// The accessibility violations tracked to a deadline (Accessibility pack,
// FAILURES = deadline): apps/e2e/a11y-known.json. A serious or critical
// violation that cannot be fixed in the change that finds it is listed there
// with the state it appears in, an issue, the day it was found and a due
// date at most FIX_DAYS days later; the checks accept what is listed, and
// tools/a11y-deadlines.mjs fails the night once a due date has passed. A
// fixed violation is taken off the list in the change that fixes it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const KNOWN_FILE = fileURLToPath(new URL('../../a11y-known.json', import.meta.url))

export interface Tracked {
  /** The front end, by the folder it is built from. */
  front: string
  /** The state (tests/a11y/pages.ts) or journey step it appears in. */
  state: string
  /** The axe rule id, or `keyboard` for a step the keyboard walk cannot reach. */
  rule: string
  impact?: string
  help?: string
  /** How many elements it was found on, when it was listed. */
  elements?: number
  issue: string
  /** YYYY-MM-DD */
  found: string
  due: string
}

export function readKnown(file = KNOWN_FILE): Tracked[] {
  return JSON.parse(readFileSync(file, 'utf8')) as Tracked[]
}

export const isTracked = (known: Tracked[], rule: string, state: string): boolean =>
  known.some((k) => k.rule === rule && k.state === state)
