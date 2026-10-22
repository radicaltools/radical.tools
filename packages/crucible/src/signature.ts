// ─── Crucible: signatures and known failures ─────────────────────────────────
//
// A failure's signature is its rule, its last action and the shape of what
// differs with the ids taken out. Two runs that break a rule the same way have
// the same signature: a survey reports it once, and a finding is recorded for
// it once. A known entry describes failures by the same things, so that the
// runs that hit an open bug end quietly until it is fixed.

import type { Action, Violation } from './violation'

/** A path with its ids taken out: a segment after one of `idKeys` becomes
 *  "*", and an array index "[*]" ("views.v1.positions.a.x" with idKeys views
 *  and positions: "views.*.positions.*.x"). */
export function pathShape(path: string, idKeys: Iterable<string> = []): string {
  const keys = new Set(idKeys)
  const segments = path.split('.')
  return segments.map((segment, i) => {
    const bare = segment.replace(/\[\d+\]/g, '')
    const index = segment.slice(bare.length).replace(/\[\d+\]/g, '[*]')
    const previous = i > 0 ? segments[i - 1].replace(/\[\d+\]/g, '') : undefined
    return (previous !== undefined && keys.has(previous) ? '*' : bare) + index
  }).join('.')
}

/** The coarse shape a signature keeps: the path's shape up to its first id
 *  ("views.*"), or its first segment when it has none. */
function coarseShape(shape: string): string {
  const segments = shape.split('.')
  const id = segments.indexOf('*')
  return (id >= 0 ? segments.slice(0, id + 1) : segments.slice(0, 1)).join('.')
}

/** The failure's signature: "rule|last action|shapes". */
export function signatureOf(violation: Violation, lastAction: string | undefined, idKeys: Iterable<string> = []): string {
  const shapes = violation.shapes ?? (violation.differences ?? []).map((d) => coarseShape(pathShape(d.path, idKeys)))
  return `${violation.rule}|${lastAction ?? '-'}|${[...new Set(shapes)].sort().join(',')}`
}

/** Whether `path` matches `glob`: segments split at dots, "*" stands for one
 *  segment, "**" (last) for one or more. */
export function pathMatches(glob: string, path: string): boolean {
  const g = glob.split('.'), p = path.split('.')
  for (let i = 0; i < g.length; i++) {
    if (g[i] === '**') return p.length > i
    if (i >= p.length) return false
    if (g[i] !== '*' && g[i] !== p[i]) return false
  }
  return g.length === p.length
}

/** What a known entry's own matcher reads. */
export interface KnownContext<A extends Action> {
  /** The actions of the run so far, the last one the step that broke the rule. */
  actions: readonly A[]
  violation: Violation
  /** The steps as resolved. */
  trace: readonly string[]
}

/** A product bug a fuzz suite knows of: a run that breaks `rule` the way the
 *  entry says ends there without failing (or, where the suite asks during a
 *  step, goes on past it). Every condition it names must hold. Remove the
 *  entry with the fix. */
export interface Known<A extends Action = Action> {
  rule: string
  /** The kind of the action that broke the rule, or one of these. */
  last?: string | readonly string[]
  /** Kinds of action each done at least once in the run. */
  after?: readonly string[]
  /** Every path of what differs matches one of these (see pathMatches). */
  paths?: readonly string[]
  /** Each of these facts of the violation is truthy (true) or not (false). */
  facts?: Readonly<Record<string, boolean>>
  /** A condition of the entry's own. */
  match?: (context: KnownContext<A>) => boolean
  /** What happens, with the item or finding it is (shown in the summary). */
  note: string
  /** The id of its finding in crucible/findings, when it has one. */
  finding?: string
}

/** Whether `known` describes the violation the run's last action caused. */
export function knownMatches<A extends Action>(known: Known<A>, context: KnownContext<A>): boolean {
  const { actions, violation } = context
  if (known.rule !== violation.rule) return false
  const last = actions[actions.length - 1]?.a
  if (known.last !== undefined && !(typeof known.last === 'string' ? [known.last] : known.last).includes(last ?? '')) return false
  if (known.after && !known.after.every((kind) => actions.some((a) => a.a === kind))) return false
  if (known.paths && !(violation.differences ?? []).every((d) => known.paths!.some((glob) => pathMatches(glob, d.path)))) return false
  if (known.facts && !Object.entries(known.facts).every(([fact, value]) => !!violation.facts?.[fact] === value)) return false
  if (known.match && !known.match(context)) return false
  return true
}
