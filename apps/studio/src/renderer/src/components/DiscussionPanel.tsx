import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { commentRows, type DiscussionComment } from '@radical/common/discussions'
import { MarkdownText } from '@radical/ui/components/MarkdownText'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { discussionSession } from '../discussions/session'

export interface DiscussionTarget { folder: string; nodeId: string; label: string }

/** One panel, pinned to the node explicitly opened, with session drafts per node. */
export function DiscussionPanel({ target, onClose }: { target: DiscussionTarget; onClose: () => void }): React.ReactElement {
  const session = discussionSession(target.folder)
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const node = useDiagramStore((s) => s.c4Nodes[target.nodeId])
  const draft = session.draft(target.nodeId)
  const threads = snapshot.data?.threads.filter((t) => t.nodeId === target.nodeId) ?? []
  const label = node?.label ?? threads[0]?.nodeLabelAtCreation ?? target.label
  const input = useRef<HTMLTextAreaElement>(null)
  const panel = useRef<HTMLElement>(null)
  const pending = snapshot.pendingNode !== null
  const locked = snapshot.pendingNode === target.nodeId || !!draft.uncertain

  useEffect(() => {
    input.current?.focus()
    void session.refresh()
    const timer = setInterval(() => { void session.refresh() }, 1500)
    return () => clearInterval(timer)
  }, [session, target.nodeId])

  const reply = (threadId: string, parent: DiscussionComment): void => {
    session.edit(target.nodeId, { reply: { threadId, parent } })
    input.current?.focus()
  }
  const showComment = (id: string): void => {
    const element = panel.current?.querySelector<HTMLElement>(`[data-comment-id="${id}"]`)
    element?.scrollIntoView({ block: 'nearest' })
    element?.focus({ preventScroll: true })
  }
  return (
    <aside className="discussion-panel" role="dialog" aria-labelledby="discussion-title" ref={panel}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') { event.preventDefault(); onClose() }
      }}>
      <header className="discussion-header">
        <div><small>Discussions</small><h2 id="discussion-title">{label}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close discussions" title="Close (Esc)">✕</button>
      </header>
      <div className="discussion-content">
        {!node && <p>The node is missing. These discussions remain attached to its ID.</p>}
        <p className="discussion-note">Discussions are saved separately in this model folder. For a new, unsaved node, save the model to keep its attachment.</p>
        {snapshot.fileError && <div role="alert" className="discussion-error">{snapshot.fileError} Your draft and the last readable discussions are kept.</div>}
        <button type="button" className="discussion-refresh" disabled={pending} onClick={() => { void session.refresh() }}>Refresh discussions</button>
        {!snapshot.data && !snapshot.fileError && <p role="status">Loading discussions…</p>}
        {snapshot.data && threads.length === 0 && <p>No discussions for this node yet.</p>}
        {threads.map((thread) => (
          <section className="discussion-thread" key={thread.id} aria-label={`${thread.resolved ? 'Resolved' : 'Open'} thread`}>
            <div className="discussion-thread-heading">
              <strong>{thread.resolved ? 'Resolved' : 'Open thread'}</strong>
              <button type="button" disabled={pending || !!snapshot.fileError || !!draft.uncertain}
                onClick={() => { void session.setResolved(target.nodeId, thread) }}>{thread.resolved ? 'Reopen thread' : 'Resolve thread'}</button>
            </div>
            {commentRows(thread).map(({ comment, depth }) => {
              const parent = comment.parentCommentId ? thread.comments.find((c) => c.id === comment.parentCommentId) : undefined
              return (
                <article key={comment.id} className="discussion-comment" data-comment-id={comment.id} tabIndex={-1}
                  style={{ marginLeft: Math.min(depth, 4) * 12 }} aria-label={`Comment by ${comment.email ?? 'Anonymous'}, reply level ${depth}`}>
                  <div className="discussion-attribution"><strong>{comment.email ?? 'Anonymous'}</strong> <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div>
                  {parent && <button type="button" className="discussion-ancestry" onClick={() => showComment(parent.id)}>
                    Reply to {parent.email ?? 'Anonymous'}: {parent.body.slice(0, 64)}{parent.body.length > 64 ? '…' : ''}
                  </button>}
                  <MarkdownText text={comment.body} />
                  {!thread.resolved && <button type="button" disabled={locked || !!snapshot.fileError} onClick={() => reply(thread.id, comment)}>Reply</button>}
                </article>
              )
            })}
            {thread.resolved && <p className="discussion-note">Reopen this thread to reply.</p>}
          </section>
        ))}
        <form className="discussion-composer" onSubmit={(event) => { event.preventDefault(); void session.post(target.nodeId, label) }}>
          <h3>{draft.reply ? 'Reply' : 'Start a thread'}</h3>
          {draft.reply && <div className="discussion-reply-target">
            <span>Replying to {draft.reply.parent.email ?? 'Anonymous'}: {draft.reply.parent.body.slice(0, 100)}</span>
            <button type="button" disabled={locked} onClick={() => session.edit(target.nodeId, { reply: undefined })}>Start a new thread instead</button>
          </div>}
          <label htmlFor="discussion-body">Comment (Markdown supported)</label>
          <textarea id="discussion-body" ref={input} value={draft.body} disabled={locked} rows={5}
            onChange={(event) => session.edit(target.nodeId, { body: event.target.value })} />
          <label htmlFor="discussion-email">Email (optional)</label>
          <input id="discussion-email" type="email" autoComplete="email" value={draft.email} disabled={locked}
            onChange={(event) => session.edit(target.nodeId, { email: event.target.value })} aria-describedby="discussion-email-note" />
          <p id="discussion-email-note" className="discussion-note">An email you include is saved with your comment in the shared discussions.json file and remembered on this device. Leave it empty to post as Anonymous. No account or verification is required.</p>
          {draft.reviewRequired && <p className="discussion-error">Review the refreshed thread, then choose Reply again or start a new thread. Your text is kept.</p>}
          {draft.message && <p role="status" aria-live="polite">{draft.message}</p>}
          <button type="submit" disabled={pending || locked || !!snapshot.fileError || !snapshot.data || !draft.body.trim() || !!draft.reviewRequired}>
            {snapshot.pendingNode === target.nodeId ? 'Saving…' : 'Post comment'}
          </button>
        </form>
      </div>
    </aside>
  )
}
