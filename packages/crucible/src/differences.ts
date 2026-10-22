// ─── Crucible: where two values differ ───────────────────────────────────────

/** One place where two values differ: its path ("views.v1.positions.a.x",
 *  "steps[2]") and the value on each side. */
export interface Difference {
  path: string
  was: unknown
  now: unknown
}

export interface DifferenceOptions {
  /** What two numbers may be apart and still be the same (default 0.5). */
  tolerance?: number
  /** How many differences to collect at most (default 12). */
  max?: number
}

/** Where `a` and `b` differ, numbers within the tolerance. Records are
 *  compared key by key (a key whose value is undefined on both sides is no
 *  difference), arrays item by item when they are as long, anything else as
 *  a whole. */
export function differences(a: unknown, b: unknown, options: DifferenceOptions = {}): Difference[] {
  const out: Difference[] = []
  walk(a, b, '', out, options.tolerance ?? 0.5, options.max ?? 12)
  return out
}

function walk(a: unknown, b: unknown, path: string, out: Difference[], tol: number, max: number): void {
  if (out.length >= max) return
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > tol || Number.isNaN(a) !== Number.isNaN(b)) out.push({ path, was: a, now: b })
    return
  }
  if (a === b) return
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    if (a === undefined && b === undefined) return
    out.push({ path, was: a, now: b })
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push({ path, was: a, now: b })
      return
    }
    for (let i = 0; i < a.length; i++) walk(a[i], b[i], `${path}[${i}]`, out, tol, max)
    return
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (ao[k] === undefined && bo[k] === undefined) continue
    walk(ao[k], bo[k], path ? `${path}.${k}` : k, out, tol, max)
  }
}

/** A difference as one line: "path: was → now", numbers as they are, other
 *  values as JSON cut at 160 characters. */
export function describeDifference(d: Difference): string {
  if (typeof d.was === 'number' && typeof d.now === 'number') return `${d.path}: ${d.was} → ${d.now}`
  return `${d.path}: ${shortValue(d.was)} → ${shortValue(d.now)}`
}

/** A value as JSON for a report, cut at 160 characters. */
export function shortValue(v: unknown): string {
  const s = JSON.stringify(v)
  return s === undefined ? 'undefined' : s.length > 160 ? `${s.slice(0, 160)}…` : s
}
