import { randomUUID } from 'node:crypto'
import type { DiscussionAction, DiscussionComment, DiscussionThread, Discussions } from '@radical/common/discussions'
import { commentRows } from '@radical/common/discussions'
import { DiskDiscussions } from '@radical/node-files/discussions'
import { hasWikiMarker } from './confluence'
import { readPublicationMapping } from './confluenceTree'
import { commentClient, type FooterComment } from './confluenceComments'
import { markdownToStorage, storageToMarkdown } from './commentMarkup'
import { hash, JournalFile, type Connection, type SyncEntry, type SyncJournal } from './discussionJournal'
import { markerOf, type WikiExport } from './wikiExport'

type Client = ReturnType<typeof commentClient>
export interface PageSnapshot { nodeId: string; label: string; pageId: string; comments: FooterComment[] }
export interface ReviewItem { nodeId?: string; pageId?: string; commentId?: string; reason: string; url?: string }
export interface Snapshot { pages: PageSnapshot[]; review: ReviewItem[]; account: { accountId: string; displayName?: string }; local: Discussions; journal: SyncJournal | null; connection: Connection }
export interface Preview { token: string; account: string; imports: number; sends: number; excluded: number; review: ReviewItem[]; pages: Array<{ node: string; url: string }>; limits: string }
const remoteHash = (c: FooterComment) => hash(c.body.storage.value)
const localHash = (c: DiscussionComment) => hash(JSON.stringify(c))
const pageUrl = (site: string, id: string) => `${site}/pages/viewpage.action?pageId=${id}`
export async function readSyncSnapshot(client: Client, document: WikiExport, connection: Connection, local: Discussions, journal: SyncJournal | null, nodeIds?: ReadonlySet<string>): Promise<Snapshot> {
  if (journal && JSON.stringify(journal.connection) !== JSON.stringify(connection)) throw new Error('This folder is connected to a different publication. Restore the matching state; do not rebind.')
  if (!journal && local.threads.some((t) => t.comments.some((c) => c.confluence))) throw new Error('Imported discussions have no journal. Restore the original sync state before proceeding.')
  const account = await client.api('/current-user') as Snapshot['account']
  if (!account.accountId) throw new Error('Cannot verify the connected Confluence account.')
  const landing = await client.api(`/pages/${connection.landingId}?body-format=storage`) as { id: string; status: string; spaceId: string; body?: { storage?: { value: string } } }
  if (landing.id !== connection.landingId || landing.status !== 'current' || !hasWikiMarker(landing.body?.storage?.value ?? '', document.marker)) throw new Error('Choose the landing page of this managed wiki tree. No comments were changed.')
  const { mapping } = await readPublicationMapping(client.api, client.base, connection.landingId, document.viewId)
  if (!Object.keys(mapping).length) throw new Error('No managed tree mapping found. Publish a page tree before connecting discussions.')
  const pages: PageSnapshot[] = [], review: ReviewItem[] = []
  const current = new Set(document.pages.map((p) => p.nodeId))
  for (const id of Object.keys(mapping)) if (!current.has(id)) review.push({ nodeId: id, reason: 'Excluded: retained page is outside the current wiki view.' })
  for (const t of local.threads) if (!current.has(t.nodeId) && !review.some((r) => r.nodeId === t.nodeId)) review.push({ nodeId: t.nodeId, reason: 'Excluded: local node is outside the selected wiki view.' })
  if (nodeIds) for (const id of nodeIds) if (!current.has(id)) throw new Error('Requested node is outside the selected current wiki view.')
  for (const p of document.pages) {
    if (nodeIds && !nodeIds.has(p.nodeId)) continue
    const pageId = mapping[p.nodeId]?.id
    if (!pageId) { review.push({ nodeId: p.nodeId, reason: 'Node has no managed page. Publish the tree and review.' }); continue }
    try {
      const page = await client.api(`/pages/${pageId}?body-format=storage`) as typeof landing
      if (page.id !== pageId || page.status !== 'current' || page.spaceId !== landing.spaceId || !hasWikiMarker(page.body?.storage?.value ?? '', markerOf(`${document.viewId}:${p.nodeId}`))) throw new Error('Managed page identity changed; review the publication.')
      const comments = await client.comments(pageId)
      pages.push({ nodeId: p.nodeId, label: p.label, pageId, comments })
    } catch (e) { review.push({ nodeId: p.nodeId, pageId, url: pageUrl(client.base, pageId), reason: (e as Error).message }) }
  }
  for (const e of journal?.entries ?? []) {
    if (mapping[e.nodeId]?.id !== e.pageId) throw new Error('A linked node maps to a different page. Stop and restore/review publication identity.')
  }
  return { pages, review, account, local, journal, connection }
}
export function previewSync(snapshot: Snapshot, excluded: string[] = []): Preview {
  const { local, journal, connection } = snapshot
  const exclusions = new Set([...(journal?.excluded ?? []), ...excluded])
  const review = [...snapshot.review]
  let imports = 0, sends = 0, excludedCount = 0
  for (const page of snapshot.pages) {
    const entries = (journal?.entries ?? []).filter((e) => e.pageId === page.pageId)
    const url = pageUrl(connection.site, page.pageId)
    if (entries.some((e) => e.state === 'uncertain')) { review.push({ pageId: page.pageId, url, reason: 'Uncertain outbound comment. Inspect this page, then use --bind or --retry; all page writes and unmatched imports are paused.' }); continue }
    const blocked = new Set<string>()
    for (const c of page.comments) {
      if (exclusions.has(`remote:${c.id}`) || (c.parentCommentId && blocked.has(c.parentCommentId))) { blocked.add(c.id); excludedCount++; continue }
      const entry = entries.find((e) => e.remoteId === c.id)
      if (entry) {
        if (entry.remoteHash !== remoteHash(c) || entry.remoteVersion !== c.version.number) review.push({ pageId: page.pageId, commentId: c.id, url, reason: 'Linked remote comment was edited. Local content retained; review manually.' })
        const owner = local.threads.find((t) => t.id === entry.threadId)
        const found = owner?.comments.find((x) => x.id === entry.localId)
        if (owner?.resolved && found?.confluence && found.parentCommentId) review.push({ pageId: page.pageId, commentId: c.id, url, reason: 'Imported reply needs review in Studio. Review and reopen the thread in Studio to acknowledge the imported reply.' })
        if (entry.state === 'linked' && (!found || localHash(found) !== entry.localHash)) review.push({ pageId: page.pageId, commentId: c.id, url, reason: 'Linked local comment changed or disappeared. Review manually.' })
        continue
      }
      try { storageToMarkdown(c.body.storage.value); imports++ } catch { blocked.add(c.id); review.push({ pageId: page.pageId, commentId: c.id, url, reason: 'Unsupported remote content; this comment and its descendants are held for review.' }) }
    }
    for (const e of entries) if (e.remoteId && !page.comments.some((c) => c.id === e.remoteId)) review.push({ pageId: page.pageId, url, commentId: e.remoteId, reason: 'Linked remote comment is absent from the complete snapshot. Local copy retained; review permissions or deletion.' })
    for (const t of local.threads.filter((t) => t.nodeId === page.nodeId)) {
      const blockedLocal = new Set<string>()
      for (const { comment: c } of commentRows(t)) {
        if (exclusions.has(`local:${t.id}`) || (c.parentCommentId && blockedLocal.has(c.parentCommentId))) { blockedLocal.add(c.id); excludedCount++; continue }
        if (entries.some((e) => e.localId === c.id)) continue
        try { markdownToStorage(c.body); sends++ } catch { blockedLocal.add(c.id); review.push({ pageId: page.pageId, url, reason: `Unsupported local comment ${c.id}; simplify its Markdown before syncing.` }) }
      }
    }
  }
  for (const e of journal?.entries ?? []) if (e.state === 'importing') review.push({ pageId: e.pageId, reason: 'Pending import will be verified and completed with its original local ID.' })
  return { token: hash(JSON.stringify({ snapshot, excluded: [...exclusions].sort() })), account: snapshot.account.displayName ?? snapshot.account.accountId, imports, sends, excluded: excludedCount, review,
    pages: snapshot.pages.map((p) => ({ node: p.label, url: pageUrl(connection.site, p.pageId) })),
    limits: 'Experimental CLI sync; live editor trial pending. All supported existing footer comments are imported. Existing local and remote threads remain separate. The connected account authors outbound posts; local emails are never sent. No inline comments, edits, deletions or resolution sync. Imported replies in resolved threads need review. Version 2 discussions require an updated Studio. Use one designated runner; transfer discussions, journal and connection receipt together.' }
}
export async function applySync(snapshot: Snapshot, client: Client, disk: DiskDiscussions, file: JournalFile, exclusions: string[] = []): Promise<{ imported: number; sent: number; review: number }> {
  const journal = snapshot.journal ?? { version: 1 as const, connection: snapshot.connection, entries: [], excluded: [] }
  journal.excluded = [...new Set([...journal.excluded, ...exclusions])]
  await file.save(journal)
  let imported = 0, sent = 0
  const review = previewSync(snapshot, exclusions).review
  // Complete staged imports before discovering new work. Each ID is fixed before the local write.
  for (const e of journal.entries.filter((e) => e.state === 'importing')) {
    await disk.act(e.action!, true); e.state = 'linked'; delete e.action; await file.save(journal); imported++
  }
  for (const page of snapshot.pages) {
    if (journal.entries.some((e) => e.pageId === page.pageId && e.state === 'uncertain')) continue
    const blocked = new Set<string>()
    for (const remote of page.comments) {
      if (journal.excluded.includes(`remote:${remote.id}`) || (remote.parentCommentId && blocked.has(remote.parentCommentId))) { blocked.add(remote.id); continue }
      if (journal.entries.some((e) => e.remoteId === remote.id)) continue
      let body: string
      try { body = storageToMarkdown(remote.body.storage.value) } catch { blocked.add(remote.id); continue }
      const parent = remote.parentCommentId ? journal.entries.find((e) => e.remoteId === remote.parentCommentId && e.state === 'linked') : undefined
      if (remote.parentCommentId && !parent) { blocked.add(remote.id); review.push({ pageId: page.pageId, reason: 'Remote parent is unavailable.' }); continue }
      const local = await disk.load()
      const thread = parent ? local.threads.find((t) => t.id === parent.threadId) : undefined
      const parentComment = thread?.comments.find((c) => c.id === parent?.localId)
      if (parent && (!thread || !parentComment)) { blocked.add(remote.id); review.push({ pageId: page.pageId, reason: 'Linked local parent is missing.' }); continue }
      const comment: DiscussionComment = { id: randomUUID(), parentCommentId: parent?.localId ?? null, body, createdAt: new Date(remote.createdAt ?? remote.version.createdAt).toISOString(), confluence: { accountId: remote.authorId ?? remote.version.authorId, url: `${pageUrl(client.base, page.pageId)}#comment-${remote.id}`, ...(thread?.resolved ? { reviewRequired: true } : {}) } }
      const threadId = parent?.threadId ?? randomUUID()
      const action: DiscussionAction = parent ? { kind: 'importReply', threadId, nodeId: page.nodeId, parent: parentComment!, comment } : { kind: 'createThread', thread: { id: threadId, nodeId: page.nodeId, nodeLabelAtCreation: page.label, resolved: false, comments: [comment] } }
      const entry: SyncEntry = { state: 'importing', localId: comment.id, threadId, nodeId: page.nodeId, pageId: page.pageId, parentRemoteId: remote.parentCommentId, remoteId: remote.id, remoteHash: remoteHash(remote), remoteVersion: remote.version.number, localHash: localHash(comment), action }
      journal.entries.push(entry); await file.save(journal)
      await disk.act(action, true)
      entry.state = 'linked'; delete entry.action; await file.save(journal); imported++
      if (thread?.resolved) review.push({ pageId: page.pageId, reason: 'Reply imported into a resolved thread. Review in Studio; thread stays resolved.' })
    }
    // Only export the confirmed preview's local IDs. New Studio posts wait for the next run.
    for (const thread of snapshot.local.threads.filter((t) => t.nodeId === page.nodeId)) {
      const blockedLocal = new Set<string>()
      for (const { comment } of commentRows(thread)) {
        if (journal.entries.some((e) => e.pageId === page.pageId && e.state === 'uncertain')) break
        if (journal.excluded.includes(`local:${thread.id}`) || (comment.parentCommentId && blockedLocal.has(comment.parentCommentId))) { blockedLocal.add(comment.id); continue }
        if (journal.entries.some((e) => e.localId === comment.id)) continue
        const parent = comment.parentCommentId ? journal.entries.find((e) => e.localId === comment.parentCommentId && e.state === 'linked') : undefined
        if (comment.parentCommentId && !parent) { blockedLocal.add(comment.id); continue }
        let storage: string
        try { storage = markdownToStorage(comment.body) } catch { blockedLocal.add(comment.id); continue }
        const latest = (await disk.load()).threads.find((t) => t.id === thread.id)?.comments.find((c) => c.id === comment.id)
        if (!latest || localHash(latest) !== localHash(comment)) throw new Error('Local comment changed since preview. Preview again.')
        const payload = { ...(parent ? { parentCommentId: parent.remoteId } : { pageId: page.pageId }), body: { representation: 'storage', value: storage } }
        const entry: SyncEntry = { localId: comment.id, threadId: thread.id, nodeId: page.nodeId, pageId: page.pageId, parentRemoteId: parent?.remoteId ?? null, localHash: localHash(comment), state: 'uncertain', payload }
        journal.entries.push(entry); await file.save(journal)
        try {
          let saved = await client.api('/footer-comments', 'POST', payload) as FooterComment
          if (!/^\d+$/.test(saved.id) || journal.entries.some((e) => e !== entry && e.remoteId === saved.id)) throw new Error('Invalid remote acknowledgement')
          // Confluence can acknowledge nested creates with the thread root as parent.
          // Checkpoint the returned ID before a read-back so a crash cannot lose it.
          entry.remoteId = saved.id; await file.save(journal)
          if ((saved.pageId && saved.pageId !== page.pageId) || (saved.parentCommentId != null && saved.parentCommentId !== entry.parentRemoteId)) {
            saved = await client.api(`/footer-comments/${entry.remoteId}?body-format=storage`) as FooterComment
            if (saved.id !== entry.remoteId || saved.pageId !== page.pageId || (saved.parentCommentId ?? null) !== entry.parentRemoteId) throw new Error('Created comment has a different page or parent; review the returned ID.')
          }
          entry.remoteId = saved.id; entry.remoteHash = typeof saved.body?.storage?.value === 'string' ? remoteHash(saved) : hash(storage); entry.remoteVersion = saved.version?.number
          if (!Number.isInteger(entry.remoteVersion)) throw new Error('No confirmed remote version')
          entry.state = 'linked'; delete entry.payload; await file.save(journal); sent++
        } catch { entry.state = 'uncertain'; entry.payload = payload; review.push({ pageId: page.pageId, url: pageUrl(client.base, page.pageId), reason: `Outbound ${comment.id} is uncertain. Inspect and use --bind or --retry.` }); break }
      }
    }
  }
  const result = { imported, sent, review: review.length }
  journal.lastResult = { at: new Date().toISOString(), ...result }; await file.save(journal)
  return result
}

export async function recoverSync(snapshot: Snapshot, client: Client, file: JournalFile, localId: string, remoteId?: string): Promise<void> {
  const journal = snapshot.journal
  const entry = journal?.entries.find((e) => e.localId === localId && e.state === 'uncertain')
  if (!journal || !entry) throw new Error('Choose an uncertain local comment ID from the journal.')
  const page = snapshot.pages.find((p) => p.pageId === entry.pageId)
  if (!page) throw new Error('Recovery requires a complete, validated page snapshot.')
  let remote: FooterComment
  if (remoteId) {
    const found = page.comments.find((c) => c.id === remoteId)
    if (!found || found.parentCommentId !== entry.parentRemoteId || journal.entries.some((e) => e !== entry && e.remoteId === remoteId)) throw new Error('Remote comment does not belong to the expected page/parent, or is already linked.')
    remote = found
  } else {
    remote = await client.api('/footer-comments', 'POST', entry.payload) as FooterComment
    if (!/^\d+$/.test(remote.id) || !Number.isInteger(remote.version?.number) || journal.entries.some((e) => e.remoteId === remote.id)) throw new Error('Retry outcome uncertain; inspect the page before retrying again.')
  }
  entry.remoteId = remote.id; entry.remoteVersion = remote.version.number
  entry.remoteHash = remoteId ? remoteHash(remote) : hash((entry.payload as { body: { value: string } }).body.value)
  entry.state = 'linked'; delete entry.payload; await file.save(journal)
}
