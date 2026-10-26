import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { applyDiscussionAction, commentRows, countNodeDiscussions, parseDiscussions, submissionState, threadState, validateDiscussions, type DiscussionAction, type DiscussionComment, type DiscussionThread } from '../src/discussions'

const comment = (parentCommentId: string | null = null): DiscussionComment => ({ id: randomUUID(), parentCommentId, body: 'Question?', createdAt: '2026-10-25T10:00:00.000Z' })
const thread = (): DiscussionThread => ({ id: randomUUID(), nodeId: 'stable-existing-node', nodeLabelAtCreation: 'Payments', resolved: false, comments: [comment()] })
const reply = (t: DiscussionThread, parent = t.comments[0]): DiscussionAction => ({ kind: 'addReply', threadId: t.id, nodeId: t.nodeId, parent, comment: comment(parent.id) })

describe('node discussions', () => {
  it('counts threads by stable node ID, including resolved threads and missing targets rather than replies', () => {
    const t = thread()
    const withReply = applyDiscussionAction({ threads: [t] }, reply(t))
    const store = { threads: [...withReply.threads, { ...thread(), nodeId: t.nodeId, resolved: true }, { ...thread(), nodeId: 'missing-target', resolved: true }] }
    expect(countNodeDiscussions(store)[t.nodeId]).toEqual({ total: 2, open: 1 })
    expect(countNodeDiscussions(store)['missing-target']).toEqual({ total: 1, open: 0 })
    expect(countNodeDiscussions(store)['new-id-with-the-same-label']).toBeUndefined()
    expect(Object.keys(countNodeDiscussions(null))).toEqual([])
  })
  it('creates separate threads and preserves nested ancestry and attribution snapshots', () => {
    const t = thread()
    t.comments[0].email = 'original@example.com'
    const created = applyDiscussionAction({ threads: [] }, { kind: 'createThread', thread: t })
    const first = applyDiscussionAction(created, reply(t))
    const second = applyDiscussionAction(first, reply(first.threads[0], first.threads[0].comments[1]))
    expect(commentRows(second.threads[0]).map((r) => r.depth)).toEqual([0, 1, 2])
    expect(second.threads[0].comments[0].email).toBe('original@example.com')
    expect(second.threads[0].comments[1]).not.toHaveProperty('email')
    expect(t.comments).toHaveLength(1)
    const other = { ...thread(), nodeId: 'new-node-with-same-label' }
    const separate = applyDiscussionAction(second, { kind: 'createThread', thread: other })
    expect(separate.threads.filter((item) => item.nodeId === t.nodeId)).toHaveLength(1)
    expect(parseDiscussions(JSON.stringify(separate))).toEqual(separate)
  })

  it('keeps independent replies and rejects stale resolution and replies to resolved threads', () => {
    const t = thread()
    const first = applyDiscussionAction({ threads: [t] }, reply(t))
    const both = applyDiscussionAction(first, reply(t))
    expect(both.threads[0].comments).toHaveLength(3)
    expect(() => applyDiscussionAction(both, { kind: 'setResolved', threadId: t.id, expected: threadState(t), resolved: true })).toThrow('Thread changed')
    const resolved = applyDiscussionAction(both, { kind: 'setResolved', threadId: t.id, expected: threadState(both.threads[0]), resolved: true })
    expect(() => applyDiscussionAction(resolved, reply(t))).toThrow('resolved')
    const reopened = applyDiscussionAction(resolved, { kind: 'setResolved', threadId: t.id, expected: threadState(resolved.threads[0]), resolved: false })
    expect(applyDiscussionAction(reopened, reply(t)).threads[0].comments).toHaveLength(4)
    const changed = { ...t, comments: [{ ...t.comments[0], body: 'Edited outside the app' }] }
    expect(() => applyDiscussionAction({ threads: [changed] }, reply(t))).toThrow('Thread changed')
  })

  it('checks uncertain creates and replies by ID and content without replaying them', () => {
    const t = thread()
    const action: DiscussionAction = { kind: 'createThread', thread: t }
    expect(submissionState({ threads: [] }, action)).toBe('missing')
    const store = applyDiscussionAction({ threads: [] }, action)
    expect(submissionState(store, action)).toBe('matching')
    expect(() => applyDiscussionAction(store, action)).toThrow('already exists')
    const changed = { ...t, comments: [{ ...t.comments[0], body: 'Different content' }] }
    expect(submissionState({ threads: [changed] }, action)).toBe('conflict')
    const r = reply(t)
    const replied = applyDiscussionAction(store, r)
    expect(submissionState(replied, r)).toBe('matching')
    expect(submissionState({ threads: [{ ...replied.threads[0], id: randomUUID() }] }, r)).toBe('conflict')
  })

  it('rejects unknown fields, invalid IDs and timestamps, missing parents, multiple roots and cycles', () => {
    const t = thread()
    const child = comment(t.comments[0].id)
    const bad = [
      { threads: [], version: 2 }, { threads: [{ ...t, unknown: true }] },
      { threads: [{ ...t, id: 'invalid' }] }, { threads: [{ ...t, nodeId: '' }] },
      { threads: [{ ...t, comments: [] }] },
      { threads: [{ ...t, comments: [comment(), comment()] }] },
      { threads: [{ ...t, comments: [{ ...t.comments[0], createdAt: '2026-02-30T10:00:00.000Z' }] }] },
      { threads: [{ ...t, comments: [{ ...t.comments[0], email: '' }] }] },
      { threads: [{ ...t, comments: [{ ...t.comments[0], body: '  ' }] }] },
      { threads: [{ ...t, comments: [t.comments[0], comment(randomUUID())] }] },
      { threads: [{ ...t, comments: [t.comments[0], { ...child, parentCommentId: child.id }] }] },
      { threads: [t, { ...thread(), comments: t.comments }] },
    ]
    for (const value of bad) expect(() => validateDiscussions(value)).toThrow('Invalid discussions')
    expect(() => parseDiscussions('<<<<<<< HEAD')).toThrow()
  })

  it('handles deeply nested replies iteratively and keeps missing-node threads', () => {
    const t = thread()
    for (let i = 0; i < 2000; i++) t.comments.push(comment(t.comments[t.comments.length - 1].id))
    validateDiscussions({ threads: [t] })
    const rows = commentRows(t)
    expect(rows[2000].depth).toBe(2000)
    // Node existence, label and position are deliberately not inputs to storage actions.
    expect(applyDiscussionAction({ threads: [t] }, { kind: 'createThread', thread: thread() }).threads[0]).toEqual(t)
  })
})
