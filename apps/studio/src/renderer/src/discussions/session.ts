import { submissionState, threadState, type DiscussionAction, type DiscussionComment, type Discussions, type DiscussionThread } from '@radical/common/discussions'
import type { HostCapabilities, DiscussionResult } from '@radical/host-bridge'
import { host } from '../platform/host'

const EMAIL_KEY = 'radical-discussion-email'
export function rememberedEmail(): string {
  try { return localStorage.getItem(EMAIL_KEY) ?? '' } catch { return '' }
}
function rememberEmail(email: string): void {
  try { if (email) localStorage.setItem(EMAIL_KEY, email); else localStorage.removeItem(EMAIL_KEY) } catch { /* Remembering is optional. */ }
}

export interface DiscussionDraft {
  body: string
  email: string
  reply?: { threadId: string; parent: DiscussionComment }
  attempt?: DiscussionAction
  uncertain?: boolean
  reviewRequired?: boolean
  message: string
}
interface Snapshot {
  data: Discussions | null
  fileError: string
  pendingNode: string | null
  drafts: Record<string, DiscussionDraft>
}

/** Timeouts have an uncertain outcome: reload by submission ID, never replay. */
async function acknowledged<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('The host did not confirm completion.')), 15_000)
    })])
  } finally { clearTimeout(timer) }
}

/** Session drafts are keyed by folder and node, independently of graph selection. */
export class DiscussionSession {
  private snapshot: Snapshot = { data: null, fileError: '', pendingNode: null, drafts: {} }
  private listeners = new Set<() => void>()
  private refreshing: Promise<void> | null = null
  private generation = 0
  constructor(readonly folder: string, private readonly bridge: () => HostCapabilities = host) {}

  getSnapshot = (): Snapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private change(patch: Partial<Snapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
  draft(nodeId: string): DiscussionDraft {
    return this.snapshot.drafts[nodeId] ?? { body: '', email: rememberedEmail(), message: '' }
  }
  private patchDraft(nodeId: string, patch: Partial<DiscussionDraft>): void {
    this.change({ drafts: { ...this.snapshot.drafts, [nodeId]: { ...this.draft(nodeId), ...patch } } })
  }
  edit(nodeId: string, patch: Pick<Partial<DiscussionDraft>, 'body' | 'email' | 'reply'>): void {
    if (this.snapshot.pendingNode === nodeId || this.draft(nodeId).uncertain) return
    const reviewed = Object.prototype.hasOwnProperty.call(patch, 'reply')
    this.patchDraft(nodeId, { ...patch, attempt: undefined, message: '', reviewRequired: reviewed ? false : this.draft(nodeId).reviewRequired })
  }

  refresh = (): Promise<void> => this.load()

  private load(afterWrite = false): Promise<void> {
    if (this.snapshot.pendingNode && !afterWrite) return Promise.resolve()
    if (this.refreshing) return this.refreshing
    const generation = this.generation
    this.refreshing = (async () => {
      try {
        const load = this.bridge().loadDiscussions
        if (!load) throw new Error('Discussions require a desktop folder model.')
        const result = await acknowledged(load(this.folder))
        if (generation !== this.generation) return
        if (!result.success || !result.discussions) throw new Error(result.error ?? 'Could not read discussions.')
        this.change({ data: result.discussions, fileError: '' })
        for (const [nodeId, draft] of Object.entries(this.snapshot.drafts)) {
          if (draft.uncertain && draft.attempt) this.reconcile(nodeId, draft.attempt, result.discussions)
        }
      } catch (error) {
        if (generation === this.generation) this.change({ fileError: (error as Error).message })
      }
    })().finally(() => { this.refreshing = null })
    return this.refreshing
  }

  private posted(nodeId: string): void {
    const draft = this.draft(nodeId)
    rememberEmail(draft.email.trim())
    this.patchDraft(nodeId, { body: '', reply: undefined, attempt: undefined, uncertain: false, reviewRequired: false, message: 'Posted.' })
  }
  private reconcile(nodeId: string, action: DiscussionAction, data: Discussions): void {
    const state = submissionState(data, action)
    if (state === 'matching') this.posted(nodeId)
    else this.patchDraft(nodeId, {
      uncertain: false,
      reviewRequired: state === 'conflict',
      message: state === 'conflict' ? 'Submission IDs have different content. Review the discussion before posting again.' : 'The submission was not found after refreshing. Your draft is kept; you can retry.',
    })
  }

  async post(nodeId: string, label: string): Promise<void> {
    const draft = this.draft(nodeId)
    if (this.snapshot.pendingNode || this.snapshot.fileError || !this.snapshot.data || !draft.body.trim() || draft.uncertain || draft.reviewRequired) return
    let action = draft.attempt
    if (!action) {
      const comment: DiscussionComment = {
        id: crypto.randomUUID(), parentCommentId: draft.reply?.parent.id ?? null,
        body: draft.body, createdAt: new Date().toISOString(),
        ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      }
      action = draft.reply
        ? { kind: 'addReply', threadId: draft.reply.threadId, nodeId, parent: draft.reply.parent, comment }
        : { kind: 'createThread', thread: { id: crypto.randomUUID(), nodeId, nodeLabelAtCreation: label, resolved: false, comments: [comment] } }
      this.patchDraft(nodeId, { attempt: action })
    }
    await this.perform(nodeId, action)
  }

  async setResolved(nodeId: string, thread: DiscussionThread): Promise<void> {
    if (this.snapshot.pendingNode || this.snapshot.fileError || !this.snapshot.data || this.draft(nodeId).uncertain) return
    await this.perform(nodeId, { kind: 'setResolved', threadId: thread.id, expected: threadState(thread), resolved: !thread.resolved })
  }

  private async perform(nodeId: string, action: DiscussionAction): Promise<void> {
    // Ignore a poll that started before this mutation, even if it finishes last.
    this.generation++
    this.change({ pendingNode: nodeId })
    this.patchDraft(nodeId, { message: action.kind === 'setResolved' ? 'Saving…' : 'Posting…' })
    let checkConflict = false
    try {
      const act = this.bridge().actOnDiscussion
      if (!act) throw new Error('The desktop host does not support discussions.')
      const result: DiscussionResult = await acknowledged(act(this.folder, action))
      if (!result.success || !result.discussions) {
        if (result.conflict) {
          checkConflict = action.kind !== 'setResolved'
          this.patchDraft(nodeId, { reviewRequired: action.kind === 'addReply', attempt: undefined, message: result.error ?? 'Thread changed. Review it before trying again.' })
          return
        }
        throw new Error(result.error ?? 'The write was not confirmed.')
      }
      this.change({ data: result.discussions, fileError: '' })
      if (action.kind === 'setResolved') this.patchDraft(nodeId, { message: action.resolved ? 'Thread resolved.' : 'Thread reopened.' })
      else this.posted(nodeId)
    } catch (error) {
      this.patchDraft(nodeId, { uncertain: action.kind !== 'setResolved', message: `${(error as Error).message} Refreshing to check the outcome; your draft is kept.` })
    } finally {
      // First let an older poll finish (it cannot replace our data), then read again.
      if (this.refreshing) await this.refreshing
      await this.load(true)
      if (checkConflict && this.snapshot.data && !this.snapshot.fileError) {
        const state = submissionState(this.snapshot.data, action)
        if (state === 'matching') this.posted(nodeId)
        else if (state === 'conflict') this.patchDraft(nodeId, { reviewRequired: true, message: 'Submission IDs have different content. Review the discussion before posting again.' })
      }
      this.change({ pendingNode: null })
    }
  }
}

const sessions = new Map<string, DiscussionSession>()
export function discussionSession(folder: string): DiscussionSession {
  let session = sessions.get(folder)
  if (!session) { session = new DiscussionSession(folder); sessions.set(folder, session) }
  return session
}
