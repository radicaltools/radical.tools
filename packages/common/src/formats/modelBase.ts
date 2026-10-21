// ─── The model's base file ───────────────────────────────────────────────────
//
// The model as it was at a git commit (where the branch left main), written
// by the CLI (`radical diff --save-base`, the git hooks of `radical hooks
// install`) and the MCP server (every get_changes) for Studio, which has no
// git: it compares the open model with this copy as it is edited. Only the
// elements and relations; their positions place the ghosts of removed
// elements and are no part of the comparison. It lives under `.radical/`,
// out of version control like the rest of the editor state.
//
// A folder git does not track never gets one that way, so Radical Forge
// saves the model as it is when a run starts (source "forge", no commit)
// wherever there is no base from git: Studio then shows what the run
// changes. A base from git is never replaced by one.

import type { C4Node, C4Relation } from '../c4'
import { SELECTION_DIR } from './canvasSelection'

export const MODEL_BASE_FILE = `${SELECTION_DIR}/base.json`

/** A base older than this may belong to another branch or an older main. */
export const BASE_OLD_MS = 24 * 60 * 60 * 1000

export interface ModelBase {
  version: 1
  /** Where it came from: git (the default) or the start of a Forge run. */
  source?: 'forge'
  /** The commit the base was read from; "" for a Forge run's base. */
  commit: string
  /** How it was chosen: "merge base with origin/main", "HEAD", a ref. */
  described: string
  /** The branch checked out when it was saved; null on a detached HEAD. */
  branch: string | null
  /** ISO time it was saved. */
  savedAt: string
  nodes: C4Node[]
  relations: C4Relation[]
}

export function serializeModelBase(base: Omit<ModelBase, 'version' | 'savedAt'>, now = new Date()): string {
  const out: ModelBase = {
    version: 1,
    ...(base.source ? { source: base.source } : {}),
    commit: base.commit, described: base.described, branch: base.branch, savedAt: now.toISOString(), nodes: base.nodes, relations: base.relations,
  }
  // One line: about a megabyte for a model of a thousand elements.
  return `${JSON.stringify(out)}\n`
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The base in `text`, or null when it is not a base file. */
export function parseModelBase(text: string): ModelBase | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!isRecord(raw)) return null
  const { version, source, commit, described, branch, savedAt, nodes, relations } = raw
  if (source !== undefined && source !== 'forge') return null
  if (version !== 1 || typeof commit !== 'string' || (!commit && source !== 'forge') || typeof described !== 'string') return null
  if (typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) return null
  if (branch !== null && typeof branch !== 'string') return null
  if (!Array.isArray(nodes) || !Array.isArray(relations)) return null
  const ok = nodes.every((n) => isRecord(n) && typeof n.id === 'string' && typeof n.type === 'string' && typeof n.label === 'string')
    && relations.every((r) => isRecord(r) && typeof r.id === 'string' && typeof r.sourceId === 'string' && typeof r.targetId === 'string')
  if (!ok) return null
  return {
    version: 1,
    ...(source === 'forge' ? { source } : {}),
    commit, described, branch: branch as string | null, savedAt, nodes: nodes as unknown as C4Node[], relations: relations as unknown as C4Relation[],
  }
}

/** A base from git may belong to another branch once it is old; a Forge
 *  run's base stays the start of that run. */
export const isBaseOld = (base: Pick<ModelBase, 'savedAt' | 'source'>, now = Date.now()): boolean =>
  base.source !== 'forge' && now - Date.parse(base.savedAt) > BASE_OLD_MS

/** The name a base from git was chosen by: the branch it is the merge base
 *  with ("main" for origin/main), or the ref `radical diff --since` was
 *  given ("HEAD", a tag, a branch); null when that was the commit itself. */
export function baseName(base: Pick<ModelBase, 'commit' | 'described'>): string | null {
  const merge = /^merge base with (.+)$/.exec(base.described)
  if (merge) return merge[1].replace(/^origin\//, '')
  if (!base.described || base.commit.startsWith(base.described)) return null
  return base.described
}

/** What the changes are counted since, for a sentence: "main 534f32f",
 *  "HEAD 473d593" or "the start of the Forge run". */
export function baseSince(base: Pick<ModelBase, 'source' | 'commit' | 'described'>): string {
  if (base.source === 'forge') return 'the start of the Forge run'
  const name = baseName(base)
  const short = base.commit.slice(0, 7)
  return name ? `${name} ${short}` : short
}

/** The model as a Forge run starts on it, as a base file. */
export function forgeModelBase(nodes: C4Node[], relations: C4Relation[], now = new Date()): string {
  return serializeModelBase({ source: 'forge', commit: '', described: 'start of the Radical Forge run', branch: null, nodes, relations }, now)
}

/** Whether a Forge run may save its base over `existing` (the base file's
 *  text, or null): when there is none, it is no base, or an earlier run
 *  saved it. A base from git stays. */
export function mayReplaceWithForgeBase(existing: string | null): boolean {
  if (existing === null) return true
  const base = parseModelBase(existing)
  return !base || base.source === 'forge'
}
