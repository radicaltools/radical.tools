import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyDiscussionAction, type DiscussionAction, type Discussions } from '@radical/common/discussions'
import type { DiscussionResult, HostCapabilities } from '@radical/host-bridge'
import { DiscussionSession, rememberedEmail } from '../src/renderer/src/discussions/session'
import { useDiagramStore } from '@radical/ui/store/diagramStore'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}

function fixture() {
  let data: Discussions = { threads: [] }
  const api = {
    loadDiscussions: vi.fn(async (): Promise<DiscussionResult> => ({ success: true, discussions: data })),
    actOnDiscussion: vi.fn(async (_folder: string, action: DiscussionAction): Promise<DiscussionResult> => {
      data = applyDiscussionAction(data, action)
      return { success: true, discussions: data }
    }),
  } satisfies HostCapabilities
  return { api, session: new DiscussionSession('/model', () => api), data: () => data, setData: (next: Discussions) => { data = next } }
}

beforeEach(() => { vi.stubGlobal('localStorage', storage()) })

describe('discussion session', () => {
  it('keeps marker snapshots stable across drafts, replies and unchanged polls, while resolution updates their counts', async () => {
    const f = fixture()
    await f.session.refresh()
    f.session.edit('payments', { body: 'Root' })
    await f.session.post('payments', 'Payments')
    const counts = f.session.getNodeCounts()
    expect(counts.payments).toEqual({ total: 1, open: 1 })
    const t = f.data().threads[0]
    f.session.edit('payments', { body: 'Reply', reply: { threadId: t.id, parent: t.comments[0] } })
    expect(f.session.getNodeCounts()).toBe(counts)
    await f.session.post('payments', 'Payments')
    await f.session.refresh()
    expect(f.session.getNodeCounts()).toBe(counts)
    await f.session.setResolved('payments', f.data().threads[0])
    expect(f.session.getNodeCounts().payments).toEqual({ total: 1, open: 0 })
    const resolved = f.session.getNodeCounts()
    f.api.loadDiscussions.mockResolvedValueOnce({ success: false, error: 'Unreadable file' })
    await f.session.refresh()
    expect(f.session.getNodeCounts()).toBe(resolved)
  })

  it('shares one background poll between the canvas and panel and stops after both leave', async () => {
    const f = fixture()
    vi.useFakeTimers()
    let stopCanvas: (() => void) | undefined
    let stopPanel: (() => void) | undefined
    try {
      stopCanvas = f.session.watch()
      stopPanel = f.session.watch()
      await f.session.refresh()
      expect(f.api.loadDiscussions).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1500)
      expect(f.api.loadDiscussions).toHaveBeenCalledTimes(2)
      stopPanel(); stopPanel = undefined
      await vi.advanceTimersByTimeAsync(1500)
      expect(f.api.loadDiscussions).toHaveBeenCalledTimes(3)
      stopCanvas(); stopCanvas = undefined
      await vi.advanceTimersByTimeAsync(3000)
      expect(f.api.loadDiscussions).toHaveBeenCalledTimes(3)
    } finally { stopCanvas?.(); stopPanel?.(); vi.useRealTimers() }
  })
  it('checks timed-out submissions before allowing a manual retry and never automatically replays them', async () => {
    const f = fixture()
    await f.session.refresh()
    vi.useFakeTimers()
    try {
      f.api.actOnDiscussion.mockImplementationOnce(() => new Promise(() => {}))
      f.session.edit('payments', { body: 'Uncertain question' })
      const pending = f.session.post('payments', 'Payments')
      await vi.advanceTimersByTimeAsync(15_000)
      await pending
      expect(f.api.actOnDiscussion).toHaveBeenCalledTimes(1)
      expect(f.api.loadDiscussions).toHaveBeenCalledTimes(2)
      expect(f.session.draft('payments').body).toBe('Uncertain question')
      expect(f.session.draft('payments').message).toContain('not found')
    } finally { vi.useRealTimers() }
  })

  it('confirms a delayed commit encountered on a manual retry without creating a duplicate', async () => {
    const f = fixture()
    await f.session.refresh()
    f.api.actOnDiscussion.mockRejectedValueOnce(new Error('Uncertain outcome'))
    f.session.edit('payments', { body: 'One question' })
    await f.session.post('payments', 'Payments')
    const action = f.api.actOnDiscussion.mock.calls[0][1]
    // The first call committed after the outcome check, just before the retry.
    f.setData(applyDiscussionAction(f.data(), action))
    f.api.actOnDiscussion.mockResolvedValueOnce({ success: false, conflict: true, error: 'Submission already exists' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').message).toBe('Posted.')
    expect(f.data().threads).toHaveLength(1)
  })
  it('posts with optional remembered email without changing the model, undo, dirty state or layout', async () => {
    const f = fixture()
    await f.session.refresh()
    const model = useDiagramStore.getState()
    f.session.edit('payments', { body: '**Question?**', email: 'reviewer@example.com' })
    await f.session.post('payments', 'Payments')
    expect(useDiagramStore.getState()).toBe(model)
    expect(f.session.draft('payments').body).toBe('')
    expect(f.session.draft('payments').message).toBe('Posted.')
    expect(rememberedEmail()).toBe('reviewer@example.com')
    expect(f.session.draft('another-node').email).toBe('reviewer@example.com')
    f.session.edit('payments', { body: 'Anonymous follow-up', email: '' })
    await f.session.post('payments', 'Renamed Payments')
    expect(f.data().threads[0].comments[0].email).toBe('reviewer@example.com')
    expect(f.data().threads[1].comments[0]).not.toHaveProperty('email')
    expect(rememberedEmail()).toBe('')
  })

  it('keeps drafts and pending operations attached to their original node and folder', async () => {
    const f = fixture()
    await f.session.refresh()
    let finish!: (value: DiscussionResult) => void
    f.api.actOnDiscussion.mockImplementationOnce(async (_folder, action) => {
      const result = await new Promise<DiscussionResult>((done) => { finish = done })
      f.setData(applyDiscussionAction(f.data(), action))
      return { ...result, discussions: f.data() }
    })
    f.session.edit('payments', { body: 'Payments draft' })
    const pending = f.session.post('payments', 'Payments')
    f.session.edit('ledger', { body: 'Ledger draft' })
    const other = new DiscussionSession('/other-folder', () => f.api)
    other.edit('payments', { body: 'Other folder draft' })
    expect(f.session.getSnapshot().pendingNode).toBe('payments')
    expect(f.session.draft('payments').message).not.toBe('Posted.')
    finish({ success: true })
    await pending
    expect(f.data().threads[0].nodeId).toBe('payments')
    expect(f.data().threads[0].comments[0].body).toBe('Payments draft')
    expect(f.session.draft('ledger').body).toBe('Ledger draft')
    expect(other.draft('payments').body).toBe('Other folder draft')
  })

  it('retains failed posts and reuses the submission IDs only after checking the latest file', async () => {
    const f = fixture()
    await f.session.refresh()
    f.api.actOnDiscussion.mockResolvedValueOnce({ success: false, error: 'Permission denied' })
    f.session.edit('payments', { body: 'Keep me' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').body).toBe('Keep me')
    expect(f.session.draft('payments').message).not.toBe('Posted.')
    expect(f.session.draft('payments').uncertain).toBe(false)
    expect(f.api.loadDiscussions).toHaveBeenCalledTimes(2)
    const attempted = f.api.actOnDiscussion.mock.calls[0][1]
    await f.session.post('payments', 'Payments')
    expect(f.api.actOnDiscussion.mock.calls[1][1]).toEqual(attempted)
    expect(f.data().threads).toHaveLength(1)
  })

  it('confirms an uncertain successful write by ID without replaying it', async () => {
    const f = fixture()
    await f.session.refresh()
    f.api.actOnDiscussion.mockImplementationOnce(async (_folder, action) => {
      f.setData(applyDiscussionAction(f.data(), action))
      throw new Error('Bridge disconnected after commit')
    })
    f.session.edit('payments', { body: 'Already written' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').body).toBe('')
    expect(f.session.draft('payments').message).toBe('Posted.')
    expect(f.api.actOnDiscussion).toHaveBeenCalledTimes(1)
    expect(f.data().threads).toHaveLength(1)
  })

  it('blocks retries while an uncertain submission cannot be read, and gives changed submissions new IDs', async () => {
    const f = fixture()
    await f.session.refresh()
    f.api.actOnDiscussion.mockRejectedValueOnce(new Error('Disconnected'))
    f.api.loadDiscussions.mockResolvedValueOnce({ success: false, error: 'Invalid JSON' })
    f.session.edit('payments', { body: 'Keep me' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').uncertain).toBe(true)
    await f.session.post('payments', 'Payments')
    expect(f.api.actOnDiscussion).toHaveBeenCalledTimes(1)
    await f.session.refresh()
    const first = f.session.draft('payments').attempt
    f.session.edit('payments', { body: 'Changed submission' })
    await f.session.post('payments', 'Payments')
    expect(f.api.actOnDiscussion.mock.calls[1][1]).not.toEqual(first)
    expect(f.session.draft('payments').message).toBe('Posted.')
  })

  it('treats differing content for uncertain IDs as a conflict and keeps the draft', async () => {
    const f = fixture()
    await f.session.refresh()
    f.api.actOnDiscussion.mockImplementationOnce(async (_folder, action) => {
      const changed = applyDiscussionAction(f.data(), action)
      changed.threads[0].comments[0].body = 'Some other content'
      f.setData(changed)
      throw new Error('Lost acknowledgement')
    })
    f.session.edit('payments', { body: 'Original content' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').body).toBe('Original content')
    expect(f.session.draft('payments').reviewRequired).toBe(true)
    expect(f.session.draft('payments').message).toContain('different content')
    await f.session.post('payments', 'Payments')
    expect(f.api.actOnDiscussion).toHaveBeenCalledTimes(1)
  })

  it('retains a stale reply and requires review after resolution before posting again', async () => {
    const f = fixture()
    await f.session.refresh()
    f.session.edit('payments', { body: 'Root' })
    await f.session.post('payments', 'Payments')
    const t = f.data().threads[0]
    f.session.edit('payments', { body: 'A stale reply', reply: { threadId: t.id, parent: t.comments[0] } })
    f.setData({ threads: [{ ...t, resolved: true }] })
    f.api.actOnDiscussion.mockResolvedValueOnce({ success: false, conflict: true, error: 'Thread was resolved. Review it.' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').body).toBe('A stale reply')
    expect(f.session.draft('payments').reviewRequired).toBe(true)
    expect(f.session.getSnapshot().data?.threads[0].resolved).toBe(true)
    f.session.edit('payments', { body: 'Still a stale reply' })
    await f.session.post('payments', 'Payments')
    expect(f.api.actOnDiscussion).toHaveBeenCalledTimes(2)
    await f.session.setResolved('payments', f.data().threads[0])
    f.session.edit('payments', { reply: { threadId: t.id, parent: t.comments[0] } })
    await f.session.post('payments', 'Payments')
    expect(f.data().threads[0].comments).toHaveLength(2)
  })

  it('keeps the last valid view and draft and blocks writes on file read errors', async () => {
    const f = fixture()
    await f.session.refresh()
    f.session.edit('payments', { body: 'Question' })
    await f.session.post('payments', 'Payments')
    f.session.edit('payments', { body: 'Draft' })
    const previous = f.session.getSnapshot().data
    f.api.loadDiscussions.mockResolvedValueOnce({ success: false, error: 'File disappeared' })
    await f.session.refresh()
    expect(f.session.getSnapshot().data).toBe(previous)
    expect(f.session.getSnapshot().fileError).toBe('File disappeared')
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').body).toBe('Draft')
    expect(f.api.actOnDiscussion).toHaveBeenCalledTimes(1)
  })

  it('ignores stale polls after a post and tolerates unavailable localStorage', async () => {
    const f = fixture()
    await f.session.refresh()
    let finish!: (value: DiscussionResult) => void
    f.api.loadDiscussions.mockImplementationOnce(() => new Promise((done) => { finish = done }))
    const poll = f.session.refresh()
    f.session.edit('payments', { body: 'New question', email: 'me@example.com' })
    const post = f.session.post('payments', 'Payments')
    await vi.waitFor(() => expect(f.session.getSnapshot().data?.threads).toHaveLength(1))
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Unavailable') }, setItem: () => { throw new Error('Unavailable') } })
    finish({ success: true, discussions: { threads: [] } })
    await Promise.all([poll, post])
    expect(f.session.getSnapshot().data?.threads).toHaveLength(1)
    f.session.edit('payments', { body: 'Works without storage' })
    await f.session.post('payments', 'Payments')
    expect(f.session.draft('payments').message).toBe('Posted.')
    expect(rememberedEmail()).toBe('')
  })
})
