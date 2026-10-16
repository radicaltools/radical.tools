// ─── The model's base file ───────────────────────────────────────────────────
//
// The model as it was at a git commit (where the branch left main), written
// by the CLI (`radical diff --save-base`, the git hooks of `radical hooks
// install`) and the MCP server (every get_changes) for Studio, which has no
// git: it compares the open model with this copy as it is edited. Only the
// elements and relations; their positions place the ghosts of removed
// elements and are no part of the comparison. It lives under `.radical/`,
// out of version control like the rest of the editor state.

import type { C4Node, C4Relation } from '../c4'
import { SELECTION_DIR } from './canvasSelection'

export const MODEL_BASE_FILE = `${SELECTION_DIR}/base.json`

/** A base older than this may belong to another branch or an older main. */
export const BASE_OLD_MS = 24 * 60 * 60 * 1000

export interface ModelBase {
  version: 1
  /** The commit the base was read from. */
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
  const out: ModelBase = { version: 1, commit: base.commit, described: base.described, branch: base.branch, savedAt: now.toISOString(), nodes: base.nodes, relations: base.relations }
  // One line: about a megabyte for a model of a thousand elements.
  return `${JSON.stringify(out)}\n`
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The base in `text`, or null when it is not a base file. */
export function parseModelBase(text: string): ModelBase | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!isRecord(raw)) return null
  const { version, commit, described, branch, savedAt, nodes, relations } = raw
  if (version !== 1 || typeof commit !== 'string' || !commit || typeof described !== 'string') return null
  if (typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) return null
  if (branch !== null && typeof branch !== 'string') return null
  if (!Array.isArray(nodes) || !Array.isArray(relations)) return null
  const ok = nodes.every((n) => isRecord(n) && typeof n.id === 'string' && typeof n.type === 'string' && typeof n.label === 'string')
    && relations.every((r) => isRecord(r) && typeof r.id === 'string' && typeof r.sourceId === 'string' && typeof r.targetId === 'string')
  if (!ok) return null
  return { version: 1, commit, described, branch: branch as string | null, savedAt, nodes: nodes as unknown as C4Node[], relations: relations as unknown as C4Relation[] }
}

export const isBaseOld = (base: Pick<ModelBase, 'savedAt'>, now = Date.now()): boolean =>
  now - Date.parse(base.savedAt) > BASE_OLD_MS
