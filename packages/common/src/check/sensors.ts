// ─── radical check: what a fitness function measures ────────────────────────
//
// An automated fitness function says what to run in its `measure`, one
// measurement a line: a sensor of `radical sense` and its arguments, as they
// are given on the command line (`playwright tests/load.spec.ts --label
// env=staging`). The sensors themselves are the CLI's (apps/cli/src/sensors);
// their names are here so that radical check, Studio and the MCP server can
// tell a line no sensor can run, and the CLI's contract test keeps the two
// lists the same.

/** The sensors of `radical sense` a measure line can name. */
export const SENSOR_NAMES = ['command', 'json', 'playwright'] as const

export interface MeasureLine {
  raw: string
  sensor: string
  args: string[]
}

/** A command line's words: split at spaces, with '…' and "…" kept whole. */
export function commandWords(line: string): string[] {
  const words: string[] = []
  let word = ''
  let quote: string | null = null
  let started = false
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null
      else word += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (/\s/.test(ch)) {
      if (started || word) words.push(word)
      word = ''
      started = false
    } else {
      word += ch
    }
  }
  if (started || word) words.push(word)
  return words
}

/** The lines of a `measure` property; blank lines and # comments left out. */
export function parseMeasure(text: unknown): MeasureLine[] {
  if (typeof text !== 'string') return []
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((raw) => {
    const [sensor = '', ...args] = commandWords(raw)
    return { raw, sensor, args }
  })
}

export const isSensorName = (name: string): boolean => (SENSOR_NAMES as readonly string[]).includes(name)
