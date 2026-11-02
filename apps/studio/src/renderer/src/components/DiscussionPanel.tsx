import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { commentRows, type DiscussionComment } from '@radical/common/discussions'
import { MarkdownText } from '@radical/ui/components/MarkdownText'
import { keepKeysHere } from '@radical/ui/components/keysHere'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { discussionSession } from '../discussions/session'

export interface DiscussionTarget { documentId: string; nodeId: string; label: string }

/** One panel, pinned to the node explicitly opened, with session drafts per node. */
export function DiscussionPanel({ target, onClose }: { target: DiscussionTarget; onClose: () => void }): React.ReactElement {
  const session = discussionSession(target.documentId)
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
    return session.watch()
  }, [session, target.nodeId])

  // Post comment and Resolve thread are disabled while they save, and a
  // disabled button loses the focus to the page: Escape, taken by the panel,
  // no longer closed it. The panel holds the focus meanwhile, then gives it
  // back to the button, or to the comment field when the button cannot take
  // it (Post comment, the draft emptied).
  const focusAfter = useRef<HTMLElement | null>(null)
  const holdFocus = (control: HTMLElement | null): void => {
    focusAfter.current = control
    panel.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    const control = focusAfter.current
    if (pending || !control) return
    focusAfter.current = null
    // Unless the focus went somewhere else meanwhile.
    if (document.activeElement !== panel.current && document.activeElement !== document.body) return
    if (control.isConnected && !(control as HTMLButtonElement).disabled) control.focus()
    else input.current?.focus()
  }, [pending])

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
    <aside className="discussion-panel" role="dialog" aria-labelledby="discussion-title" ref={panel} tabIndex={-1}
      onKeyDown={(event) => {
        keepKeysHere(event)
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
        <details className="discussion-note"><summary>Sync discussions with Confluence</summary><p>Use the CLI on your designated runner: <code>radical discussions confluence connect &lt;folder&gt; --view &lt;wiki&gt; --page &lt;landing-url&gt;</code>. Review the preview, then repeat with <code>--apply --expect &lt;token&gt;</code>. Later use <code>sync</code>; use <code>status</code> for the last result. Keep discussions.json and both Confluence state files together when transferring runners. Live editor compatibility is experimental.</p></details>
        <button type="button" className="discussion-refresh" disabled={pending} onClick={() => { void session.refresh() }}>Refresh discussions</button>
        {!snapshot.data && !snapshot.fileError && <p role="status">Loading discussions…</p>}
        {snapshot.data && threads.length === 0 && <p>No discussions for this node yet.</p>}
        {threads.map((thread) => (
          <section className="discussion-thread" key={thread.id} aria-label={`${thread.resolved ? 'Resolved' : 'Open'} thread`}>
            <div className="discussion-thread-heading">
              <strong>{thread.resolved ? 'Resolved' : 'Open thread'}</strong>
              <button type="button" disabled={pending || !!snapshot.fileError || !!draft.uncertain}
                onClick={(event) => { holdFocus(event.currentTarget); void session.setResolved(target.nodeId, thread) }}>{thread.resolved ? 'Reopen thread' : 'Resolve thread'}</button>
            </div>
            {commentRows(thread).map(({ comment, depth }) => {
              const parent = comment.parentCommentId ? thread.comments.find((c) => c.id === comment.parentCommentId) : undefined
              return (
                <article key={comment.id} className="discussion-comment" data-comment-id={comment.id} tabIndex={-1}
                  style={{ marginLeft: Math.min(depth, 4) * 12 }} aria-label={`Comment by ${comment.confluence?.displayName ?? (comment.confluence ? `Confluence account ${comment.confluence.accountId}` : comment.email ?? 'Anonymous')}, reply level ${depth}`}>
                  <div className="discussion-attribution"><strong>{comment.confluence?.displayName ?? (comment.confluence ? `Confluence account ${comment.confluence.accountId}` : comment.email ?? 'Anonymous')}</strong> <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div>
                  {parent && <button type="button" className="discussion-ancestry" onClick={() => showComment(parent.id)}>
                    Reply to {parent.confluence?.displayName ?? (parent.confluence ? `Confluence account ${parent.confluence.accountId}` : parent.email ?? 'Anonymous')}: {parent.body.slice(0, 64)}{parent.body.length > 64 ? '…' : ''}
                  </button>}
                  {comment.confluence && <p className="discussion-note"><a href={comment.confluence.url} target="_blank" rel="noreferrer">View in Confluence</a>{(thread.resolved && comment.parentCommentId) && ' · Imported reply needs review; this thread remains resolved.'}</p>}
                  <MarkdownText text={comment.body} />
                  {!thread.resolved && <button type="button" disabled={locked || !!snapshot.fileError} onClick={() => reply(thread.id, comment)}>Reply</button>}
                </article>
              )
            })}
            {thread.resolved && <p className="discussion-note">Reopen this thread to reply.</p>}
          </section>
        ))}
        <form className="discussion-composer" onSubmit={(event) => { event.preventDefault(); holdFocus(input.current); void session.post(target.nodeId, label) }}>
          <h3>{draft.reply ? 'Reply' : 'Start a thread'}</h3>
          {draft.reply && <div className="discussion-reply-target">
            <span>Replying to {draft.reply.parent.confluence?.displayName ?? (draft.reply.parent.confluence ? `Confluence account ${draft.reply.parent.confluence.accountId}` : draft.reply.parent.email ?? 'Anonymous')}: {draft.reply.parent.body.slice(0, 100)}</span>
            {/* The button goes with the reply: the focus goes on to the comment. */}
            <button type="button" disabled={locked} onClick={() => { session.edit(target.nodeId, { reply: undefined }); input.current?.focus() }}>Start a new thread instead</button>
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
