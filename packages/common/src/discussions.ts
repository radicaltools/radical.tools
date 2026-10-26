/** Discussions are a companion file, deliberately outside DiagramData. */
export const DISCUSSIONS_FILE = 'discussions.json'
export const DISCUSSIONS_LOCK_FILE = '.discussions.lock'
export const DISCUSSIONS_WEB_LOCK_FILE = '.discussions.web.lock'

export interface DiscussionComment {
  id: string
  parentCommentId: string | null
  body: string
  createdAt: string
  email?: string
}

export interface DiscussionThread {
  id: string
  nodeId: string
  nodeLabelAtCreation: string
  resolved: boolean
  comments: DiscussionComment[]
}

export interface Discussions { threads: DiscussionThread[] }

export type NodeDiscussionCounts = Readonly<Record<string, { readonly total: number; readonly open: number }>>

/** Includes resolved and missing-node threads; rendering decides which nodes exist. */
export function countNodeDiscussions(store: Discussions | null): NodeDiscussionCounts {
  const counts: Record<string, { total: number; open: number }> = Object.create(null)
  for (const thread of store?.threads ?? []) {
    const count = counts[thread.nodeId] ?? (counts[thread.nodeId] = { total: 0, open: 0 })
    count.total++
    if (!thread.resolved) count.open++
  }
  return counts
}

export type DiscussionAction =
  | { kind: 'createThread'; thread: DiscussionThread }
  | { kind: 'addReply'; threadId: string; nodeId: string; parent: DiscussionComment; comment: DiscussionComment }
  | { kind: 'setResolved'; threadId: string; expected: string; resolved: boolean }

export class DiscussionConflict extends Error {}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid discussions: ${message}`)
}
function record(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'expected an object')
  const obj = value as Record<string, unknown>
  requireValue(required.every((key) => Object.prototype.hasOwnProperty.call(obj, key)) && Object.keys(obj).every((key) => required.includes(key) || optional.includes(key)), 'unrecognized or missing fields')
  return obj
}
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

/** Reject unknown structures rather than silently dropping information. */
export function validateDiscussions(value: unknown): asserts value is Discussions {
  const store = record(value, ['threads'])
  requireValue(Array.isArray(store.threads), 'threads must be an array')
  const ids = new Set<string>()
  const takeId = (id: unknown): void => {
    requireValue(typeof id === 'string' && uuid.test(id) && !ids.has(id), 'invalid or duplicate UUID')
    ids.add(id)
  }
  for (const raw of store.threads) {
    const thread = record(raw, ['id', 'nodeId', 'nodeLabelAtCreation', 'resolved', 'comments'])
    takeId(thread.id)
    requireValue(nonempty(thread.nodeId) && typeof thread.nodeLabelAtCreation === 'string' && typeof thread.resolved === 'boolean', 'invalid thread')
    requireValue(Array.isArray(thread.comments) && thread.comments.length > 0, 'thread needs a root')
    const parents = new Map<string, string | null>()
    for (const rawComment of thread.comments) {
      const comment = record(rawComment, ['id', 'parentCommentId', 'body', 'createdAt'], ['email'])
      takeId(comment.id)
      requireValue(comment.parentCommentId === null || (typeof comment.parentCommentId === 'string' && uuid.test(comment.parentCommentId)), 'invalid parent ID')
      requireValue(nonempty(comment.body), 'empty comment')
      requireValue(typeof comment.createdAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(comment.createdAt) && Number.isFinite(Date.parse(comment.createdAt)) && new Date(comment.createdAt).toISOString() === comment.createdAt, 'invalid UTC timestamp')
      requireValue(!Object.prototype.hasOwnProperty.call(comment, 'email') || nonempty(comment.email), 'invalid email')
      parents.set(comment.id as string, comment.parentCommentId as string | null)
    }
    requireValue((thread.comments[0] as DiscussionComment).parentCommentId === null && [...parents.values()].filter((p) => p === null).length === 1, 'expected exactly one first root')
    // Iterative traversal also handles very deep reply trees without recursion.
    const complete = new Set<string>()
    for (const id of parents.keys()) {
      const path = new Set<string>()
      let current: string | null = id
      while (current !== null && !complete.has(current)) {
        requireValue(parents.has(current), 'parent outside thread')
        requireValue(!path.has(current), 'reply cycle')
        path.add(current)
        current = parents.get(current)!
      }
      for (const visited of path) complete.add(visited)
    }
  }
}

export function parseDiscussions(text: string): Discussions {
  const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
  validateDiscussions(value)
  return value
}

export const threadState = (thread: DiscussionThread): string => JSON.stringify(thread)
const sameComment = (a: DiscussionComment, b: DiscussionComment): boolean => a.id === b.id && a.parentCommentId === b.parentCommentId && a.body === b.body && a.createdAt === b.createdAt && a.email === b.email

/** Check IDs after an uncertain create, without replaying the action. */
export function submissionState(store: Discussions, action: DiscussionAction): 'missing' | 'matching' | 'conflict' {
  if (action.kind === 'setResolved') return 'missing'
  const threadId = action.kind === 'createThread' ? action.thread.id : action.threadId
  const comment = action.kind === 'createThread' ? action.thread.comments[0] : action.comment
  const thread = store.threads.find((t) => t.id === threadId)
  const owner = store.threads.find((t) => t.comments.some((c) => c.id === comment.id))
  if (!owner && (action.kind !== 'createThread' || !thread)) return 'missing'
  if (!thread || owner !== thread) return 'conflict'
  if (action.kind === 'addReply' && thread.nodeId !== action.nodeId) return 'conflict'
  if (action.kind === 'createThread' && (thread.nodeId !== action.thread.nodeId || thread.nodeLabelAtCreation !== action.thread.nodeLabelAtCreation)) return 'conflict'
  const found = thread.comments.find((c) => c.id === comment.id)
  return found && sameComment(found, comment) ? 'matching' : 'conflict'
}

/** Apply to the latest validated store; unrelated concurrent replies commute. */
export function applyDiscussionAction(store: Discussions, action: DiscussionAction): Discussions {
  validateDiscussions(store)
  const next: Discussions = JSON.parse(JSON.stringify(store))
  if (action.kind === 'createThread') {
    validateDiscussions({ threads: [action.thread] })
    requireValue(action.thread.comments.length === 1 && !action.thread.resolved, 'new thread must contain one open root')
    if (submissionState(store, action) !== 'missing') throw new DiscussionConflict('Submission already exists. Refresh and review it.')
    next.threads.push(JSON.parse(JSON.stringify(action.thread)))
  } else {
    const thread = next.threads.find((t) => t.id === action.threadId)
    if (!thread) throw new DiscussionConflict('Thread is missing. Refresh and review before trying again.')
    if (action.kind === 'setResolved') {
      requireValue(typeof action.resolved === 'boolean', 'invalid resolution')
      if (threadState(thread) !== action.expected) throw new DiscussionConflict('Thread changed. Review the refreshed thread before changing its resolution.')
      thread.resolved = action.resolved
    } else {
      const parent = thread.comments.find((c) => c.id === action.comment.parentCommentId)
      if (thread.resolved || thread.nodeId !== action.nodeId || !parent || !sameComment(parent, action.parent)) throw new DiscussionConflict('Thread changed or was resolved. Review it and choose Reply again; your draft is kept.')
      thread.comments.push(JSON.parse(JSON.stringify(action.comment)))
    }
  }
  validateDiscussions(next)
  return next
}

/** Flatten in ancestry order; cap indentation in the UI, never the relationship. */
export function commentRows(thread: DiscussionThread): Array<{ comment: DiscussionComment; depth: number }> {
  const children = new Map<string | null, DiscussionComment[]>()
  for (const comment of thread.comments) {
    const list = children.get(comment.parentCommentId)
    if (list) list.push(comment)
    else children.set(comment.parentCommentId, [comment])
  }
  const stack = (children.get(null) ?? []).map((comment) => ({ comment, depth: 0 }))
  const rows: Array<{ comment: DiscussionComment; depth: number }> = []
  while (stack.length) {
    const row = stack.pop()!
    rows.push(row)
    const replies = children.get(row.comment.id) ?? []
    for (let i = replies.length - 1; i >= 0; i--) stack.push({ comment: replies[i], depth: row.depth + 1 })
  }
  return rows
}
