import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { DiagramData, DiagramView } from '@radical/common/c4'
import { main } from './cli'
import { exportWiki, anchor, markerOf } from './wikiExport'
import { readSyncSnapshot } from './discussionSync'
import { DiskDiscussions } from '@radical/node-files/discussions'
import { applyDiscussionAction, parseDiscussions, type DiscussionThread } from '@radical/common/discussions'
import { commentClient, UncertainCreate, type FooterComment } from './confluenceComments'
import { markdownToStorage, storageToMarkdown } from './commentMarkup'
import { hash, JournalFile, lockSync, type SyncJournal } from './discussionJournal'
import { applySync, previewSync, recoverSync, type Snapshot } from './discussionSync'
import { landingConnection } from './discussionsCommand'

const dirs: string[] = []
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }) })
const folder = async () => { const d = await mkdtemp(join(tmpdir(), 'radical-confluence-sync-')); dirs.push(d); return d }
const options = { url: 'https://example.atlassian.net', email: 'runner@example.com', token: 'do-not-log-token' }
const connection = { site: options.url + '/wiki', landingId: '1', viewId: 'wiki', marker: 'marker' }
const remote = (id = '10', parentCommentId: string | null = null): FooterComment => ({ id, parentCommentId, pageId: '2', status: 'current', version: { number: 1, createdAt: '2026-10-31T10:00:00.000Z', authorId: 'author-account' }, body: { storage: { value: '<p>Hello <strong>world</strong></p>' } } })
const thread = (): DiscussionThread => ({ id: randomUUID(), nodeId: 'node', nodeLabelAtCreation: 'Node', resolved: false, comments: [{ id: randomUUID(), parentCommentId: null, body: 'Local question', createdAt: '2026-10-31T11:00:00.000Z', email: 'private@example.com' }] })
const snapshot = (comments: FooterComment[] = [remote()]): Snapshot => ({ connection, account: { accountId: 'runner' }, local: { threads: [] }, journal: null, review: [], pages: [{ pageId: '2', nodeId: 'node', label: 'Node', comments }] })
const client = (request = vi.fn(async () => Response.json({}))) => commentClient(options, request as typeof fetch)

describe('comment markup boundary', () => {
  it('decodes standard named entities used by Confluence without interpreting encoded HTML', () => {
    expect(storageToMarkdown('<p>Za&#380;&oacute;&#322;&#263; &copy; &euro;</p>')).toBe('Za\u017c\u00f3\u0142\u0107 \u00a9 \u20ac')
    expect(markdownToStorage(storageToMarkdown('<p>&lt;script&gt;x&lt;/script&gt;</p>'))).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>')
    expect(() => storageToMarkdown('<p>&madeup;</p>')).toThrow('Unsupported entity')
    expect(() => storageToMarkdown('<p>&#x110000;</p>')).toThrow('Invalid character reference')
  })

  it('accepts Confluence paragraph local-id metadata without losing user text', () => {
    expect(storageToMarkdown('<p local-id="012345abcdef">This scenario needs clarification</p>')).toBe('This scenario needs clarification')
    expect(storageToMarkdown("<p local-id='abcdef012345'>This cannot be implemented yet</p>")).toBe('This cannot be implemented yet')
    expect(() => storageToMarkdown('<p local-id="abc" onclick="alert(1)">text</p>')).toThrow('Unsupported attributes')
    expect(() => storageToMarkdown('<p local-id="&quot; onclick=evil">text</p>')).toThrow('Unsupported attributes')
  })

  it('round trips plain text, basic formatting, code and safe links', () => {
    const markdown = 'Hello **world**, *friend*, `code` and [link](https://example.com/a?b=1&c=2).'
    const storage = markdownToStorage(markdown)
    expect(storage).toContain('<strong>world</strong>')
    expect(markdownToStorage(storageToMarkdown(storage))).toBe(storage)
    expect(storageToMarkdown('<p>&lt;script&gt; &amp; &#x1f600;</p>')).toContain('script')
  })
  it.each(['<ac:structured-macro ac:name="x"/>', '<img src="x"/>', '<a href="javascript:alert(1)">x</a>', '<p onclick="x">x</p>', '<p><strong>x</p>', '<p>&unknown;</p>'])('holds unsupported remote content: %s', (s) => expect(() => storageToMarkdown(s)).toThrow())
  it.each(['![image](https://example.com/x)', '# Heading', '- item', '<script>alert(1)</script>', '[link](javascript:alert(1))', '```\ncode\n```'])('holds unsupported outbound content: %s', (s) => expect(() => markdownToStorage(s)).toThrow())
})

describe('safe Confluence adapter', () => {
  it('reads all root pages and deep children, deduplicates IDs', async () => {
    const request = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url))
      if (u.pathname.endsWith('/pages/2/footer-comments')) return Response.json(u.searchParams.has('cursor') ? { results: [remote('11') ] } : { results: [remote()], _links: { next: '/wiki/api/v2/pages/2/footer-comments?cursor=next' } })
      if (u.pathname.endsWith('/10/children')) return Response.json({ results: [remote('12', '10'), remote('12', '10')] })
      if (u.pathname.endsWith('/12/children')) return Response.json({ results: [remote('13', '12')] })
      return Response.json({ results: [] })
    })
    expect((await commentClient(options, request as typeof fetch).comments('2')).map((c) => [c.id, c.parentCommentId])).toEqual([['10', null], ['11', null], ['12', '10'], ['13', '12']])
  })
  it.each(['https://evil.test/wiki/api/v2/pages/2/footer-comments?cursor=x', '/wiki/api/v2/pages/3/footer-comments?cursor=x', '/wiki/api/v2/pages/2/footer-comments?body-format=storage&limit=100'])('rejects unsafe pagination and loops: %s', async (next) => {
    const request = vi.fn(async () => Response.json({ results: [], _links: { next } }))
    await expect(client(request).comments('2')).rejects.toThrow()
  })
  it('never retries writes, including 429, timeout and malformed acknowledgements', async () => {
    for (const result of [() => new Response('', { status: 429 }), () => { throw new Error('network') }, () => new Response('not JSON')]) {
      const request = vi.fn(async () => result())
      await expect(client(request).api('/footer-comments', 'POST', {})).rejects.toBeInstanceOf(UncertainCreate)
      expect(request).toHaveBeenCalledTimes(1)
    }
  })
  it('retries safe rate-limited reads with a bound', async () => {
    const request = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
    await expect(client(request).comments('2')).rejects.toThrow('429')
    expect(request).toHaveBeenCalledTimes(4)
  })
  it('rejects a partial child fetch instead of returning a truncated tree', async () => {
    const request = vi.fn(async () => request.mock.calls.length === 1 ? Response.json({ results: [remote()] }) : new Response('', { status: 403 }))
    await expect(client(request).comments('2')).rejects.toThrow('403')
  })
})

describe('journaled sync', () => {
  it('preview makes no file or network writes, preserves independent existing conversations', async () => {
    const d = await folder(), s = snapshot(); s.local.threads.push(thread())
    const p = previewSync(s)
    expect(p).toMatchObject({ imports: 1, sends: 1, excluded: 0 })
    expect(p.token).toBe(previewSync(s).token)
    expect(await readdir(d)).toEqual([])
  })
  it('imports roots and nested replies once using stable IDs and accurate provenance', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), s = snapshot([remote(), remote('11', '10'), remote('12', '11')])
    await file.load()
    expect(await applySync(s, client(), disk, file)).toMatchObject({ imported: 3, sent: 0 })
    const local = await disk.load(), journal = await file.load()
    expect(local.version).toBe(2)
    expect(local.threads).toHaveLength(1)
    expect(local.threads[0].comments.map((c) => c.confluence?.accountId)).toEqual(['author-account', 'author-account', 'author-account'])
    expect(local.threads[0].comments[2].parentCommentId).toBe(local.threads[0].comments[1].id)
    expect(await applySync({ ...s, local, journal }, client(), disk, file)).toEqual({ imported: 0, sent: 0, review: 0 })
    expect((await disk.load()).threads).toEqual(local.threads)
  })
  it('resumes after crash between pending import and disk write', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), s = snapshot()
    await file.load()
    vi.spyOn(disk, 'act').mockRejectedValueOnce(new Error('crash before local write'))
    await expect(applySync(s, client(), disk, file)).rejects.toThrow('crash')
    const journal = (await file.load())!, id = journal.entries[0].localId
    expect(journal.entries[0].state).toBe('importing')
    await applySync({ ...s, journal }, client(), disk, file)
    expect((await disk.load()).threads[0].comments[0].id).toBe(id)
  })
  it('resumes after crash between disk write and journal checkpoint, keeping a concurrent Studio post', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), s = snapshot()
    await file.load()
    const original = disk.act.bind(disk)
    vi.spyOn(disk, 'act').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('crash after local write') })
    await expect(applySync(s, client(), disk, file)).rejects.toThrow('crash')
    const pending = (await file.load())!, id = pending.entries[0].localId
    const concurrent = thread(); concurrent.nodeId = 'another-node'
    await disk.act({ kind: 'createThread', thread: concurrent })
    await applySync({ ...s, local: await disk.load(), journal: pending }, client(), disk, file)
    const local = await disk.load()
    expect(local.threads).toHaveLength(2)
    expect(local.threads[0].comments[0].id).toBe(id)
    expect(local.threads[1]).toEqual(concurrent)
  })
  it('imports a reply into a resolved thread without weakening local reply rules', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), s = snapshot()
    await file.load(); await applySync(s, client(), disk, file)
    let local = await disk.load(); local.threads[0].resolved = true
    await writeFile(join(d, 'discussions.json'), JSON.stringify(local))
    const journal = await file.load()
    const result = await applySync({ ...s, local, journal, pages: [{ ...s.pages[0], comments: [remote(), remote('11', '10')] }] }, client(), disk, file)
    local = await disk.load()
    expect(local.threads[0].resolved).toBe(true)
    expect(local.threads[0].comments[1].confluence?.reviewRequired).toBe(true)
    expect(result.review).toBeGreaterThan(0)
    const t = local.threads[0], parent = t.comments[0]
    expect(() => applyDiscussionAction(local, { kind: 'addReply', threadId: t.id, nodeId: t.nodeId, parent, comment: { ...t.comments[1], id: randomUUID() } })).toThrow('resolved')
  })
  it('exports parent before child without leaking emails and reruns without creates', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), t = thread(), s = snapshot([])
    t.comments.push({ id: randomUUID(), parentCommentId: t.comments[0].id, body: 'Nested reply', createdAt: t.comments[0].createdAt })
    s.local.threads.push(t)
    await writeFile(join(d, 'discussions.json'), JSON.stringify(s.local)); await file.load()
    const payloads: unknown[] = []
    const request = vi.fn(async (_url, init) => { payloads.push(JSON.parse(init!.body as string)); return Response.json({ id: String(20 + payloads.length), version: { number: 1 } }) })
    const api = commentClient(options, request as typeof fetch)
    expect(await applySync(s, api, disk, file)).toMatchObject({ sent: 2 })
    expect(payloads[0]).toMatchObject({ pageId: '2' }); expect(payloads[1]).toMatchObject({ parentCommentId: '21' })
    expect(JSON.stringify(payloads)).not.toContain('private@example.com')
    const journal = (await file.load())!
    const comments = journal.entries.map((e, i) => ({ ...remote(e.remoteId!, i ? journal.entries[0].remoteId! : null), body: { storage: { value: (payloads[i] as { body: { value: string } }).body.value } } }))
    expect(await applySync({ ...s, journal, pages: [{ ...s.pages[0], comments }] }, api, disk, file)).toEqual({ sent: 0, imported: 0, review: 0 })
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('never blindly retries or imports possible duplicates after an uncertain outbound create; binding validates ancestry', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), t = thread(), s = snapshot([])
    s.local.threads.push(t); await writeFile(join(d, 'discussions.json'), JSON.stringify(s.local)); await file.load()
    const request = vi.fn(async () => { throw new Error('timeout after remote create') })
    const api = client(request)
    expect((await applySync(s, api, disk, file)).review).toBeGreaterThan(0)
    const journal = (await file.load())!
    expect(journal.entries[0].state).toBe('uncertain')
    const updated = { ...s, journal, pages: [{ ...s.pages[0], comments: [remote()] }] }
    await applySync(updated, api, disk, file)
    expect(request).toHaveBeenCalledTimes(1); expect((await disk.load()).threads).toHaveLength(1)
    await expect(recoverSync(updated, api, file, t.comments[0].id, '999')).rejects.toThrow('expected page/parent')
    await recoverSync(updated, api, file, t.comments[0].id, '10')
    expect((await file.load())!.entries[0]).toMatchObject({ localId: t.comments[0].id, remoteId: '10', state: 'linked' })
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('persists exclusions across runs, including descendants', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), s = snapshot([remote(), remote('11', '10')])
    await file.load(); await applySync(s, client(), disk, file, ['remote:10'])
    const next = { ...s, journal: await file.load() }
    expect(previewSync(next)).toMatchObject({ imports: 0, excluded: 2 })
    await applySync(next, client(), disk, file)
    expect((await disk.load()).threads).toHaveLength(0)
  })
  it('holds unsupported parents and descendants and reports remote edits or disappearance without overwriting', async () => {
    const s = snapshot([ { ...remote(), body: { storage: { value: '<ac:macro/>' } } }, remote('11', '10') ])
    expect(previewSync(s)).toMatchObject({ imports: 0 })
    expect(previewSync(s).review).toHaveLength(1)
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), original = snapshot()
    await file.load(); await applySync(original, client(), disk, file)
    const journal = await file.load(), local = await disk.load()
    const edited = { ...original, local, journal, pages: [{ ...original.pages[0], comments: [{ ...remote(), version: { ...remote().version, number: 2 } }] }] }
    expect(previewSync(edited).review[0].reason).toContain('edited')
    const disappeared = { ...edited, pages: [{ ...original.pages[0], comments: [] }] }
    await applySync(disappeared, client(), disk, file)
    expect((await disk.load()).threads).toEqual(local.threads)
    expect(previewSync(disappeared).review[0].reason).toContain('absent')
  })
  it('rejects missing, corrupt, externally changed journals and competing local runners', async () => {
    const d = await folder(), file = new JournalFile(d)
    await file.load()
    const journal: SyncJournal = { version: 1, connection, entries: [], excluded: [] }
    await file.save(journal)
    const release = await lockSync(d)
    await expect(lockSync(d)).rejects.toThrow('Sync lock'); await release()
    await writeFile(join(d, 'discussions-confluence-sync.json'), '{}')
    await expect(file.save(journal)).rejects.toThrow('changed outside')
    await expect(new JournalFile(d).load()).rejects.toThrow('corrupt')
    await rm(join(d, 'discussions-confluence-sync.json'))
    await expect(new JournalFile(d).load()).rejects.toThrow('missing')
  })
  it('keeps legacy discussions lossless and rejects unknown versions and altered provenance', () => {
    const legacy = { threads: [thread()] }
    expect(parseDiscussions(JSON.stringify(legacy))).toEqual(legacy)
    expect(() => parseDiscussions(JSON.stringify({ ...legacy, version: 99 }))).toThrow('unsupported version')
    legacy.threads[0].comments[0].confluence = { accountId: 'id', url: 'javascript:alert(1)' }
    expect(() => parseDiscussions(JSON.stringify({ ...legacy, version: 2 }))).toThrow('unsafe')
  })
  it('validates the supplied Cloud landing URL without taking credentials from it', () => {
    expect(landingConnection('https://example.atlassian.net/wiki/spaces/test-space/pages/123456/Tes+confluence')).toEqual({ site: 'https://example.atlassian.net/wiki', landingId: '123456' })
    expect(() => landingConnection('https://user:secret@example.atlassian.net/wiki/pages/viewpage.action?pageId=1')).toThrow()
    expect(() => landingConnection('https://example.test/wiki/pages/viewpage.action?pageId=1')).toThrow()
  })
})

describe('managed tree and CLI integration', () => {
  const view: DiagramView = { id: 'wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } }
  const data: DiagramData = { metamodel: builtInGovernanceMetamodel(), views: [view], nodes: ['first', 'second'].map((id) => ({ id, type: 'requirement', label: 'Same name', x: 0, y: 0, width: 200, height: 100, collapsed: false, action: 'work' })), relations: [] }
  const document = exportWiki(data, view, {})
  function server(overrides: { wrongMarker?: boolean; failChildren?: boolean } = {}) {
    const pages = { first: { id: '2', title: 'first' }, second: { id: '3', title: 'second' }, retained: { id: '4', title: 'old' } }
    const properties = Object.entries(pages).map(([nodeId, value]) => ({ id: nodeId, key: `radical.wiki.pages.${hash(nodeId)[0]}`, value: { schema: 1, viewId: 'wiki', pages: { [nodeId]: value } } }))
    // The first and second IDs happen to use distinct buckets. Group for real property semantics.
    const grouped = new Map<string, typeof properties[0]>()
    for (const p of properties) { const old = grouped.get(p.key); if (old) Object.assign(old.value.pages, p.value.pages); else grouped.set(p.key, p) }
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method ?? 'GET').toBe('GET')
      const u = new URL(String(url)), path = u.pathname
      if (path.endsWith('/rest/api/user/current')) return Response.json({ accountId: 'runner', displayName: 'Runner' })
      if (path.endsWith('/pages/1/properties')) return Response.json({ results: [...grouped.values()] })
      if (path.endsWith('/pages/1')) return Response.json({ id: '1', status: 'current', spaceId: 'space', body: { storage: { value: anchor(document.marker) } } })
      if (path.endsWith('/pages/2') || path.endsWith('/pages/3')) {
        const id = path.endsWith('/2') ? '2' : '3', nodeId = id === '2' ? 'first' : 'second'
        return Response.json({ id, status: 'current', spaceId: 'space', body: { storage: { value: anchor(markerOf(`wiki:${overrides.wrongMarker ? 'different-node' : nodeId}`)) } } })
      }
      if (path.endsWith('/pages/2/footer-comments')) return Response.json({ results: [remote()] })
      if (path.endsWith('/10/children') && overrides.failChildren) return new Response('', { status: 403 })
      if (path.endsWith('/pages/4') || path.endsWith('/pages/4/footer-comments')) throw new Error('Retained page must never be read')
      return Response.json({ results: [] })
    })
  }
  it('uses stable node mapping despite duplicate names, skips retained pages, and holds replaced pages or incomplete reads', async () => {
    const c = { ...connection, marker: document.marker }
    const s = await readSyncSnapshot(commentClient(options, server() as typeof fetch), document, c, { threads: [] }, null)
    expect(s.pages.map((p) => [p.nodeId, p.pageId])).toEqual([['first', '2'], ['second', '3']])
    expect(s.review[0].reason).toContain('outside')
    const scopedRequest = server()
    const scoped = await readSyncSnapshot(commentClient(options, scopedRequest as typeof fetch), document, c, { threads: [] }, null, new Set(['first']))
    expect(scoped.pages.map((p) => p.nodeId)).toEqual(['first'])
    expect(scopedRequest.mock.calls.some(([url]) => new URL(String(url)).pathname.includes('/pages/3'))).toBe(false)
    await expect(readSyncSnapshot(commentClient(options, server() as typeof fetch), document, c, { threads: [] }, null, new Set(['missing-node']))).rejects.toThrow('outside the selected')
    const replaced = await readSyncSnapshot(commentClient(options, server({ wrongMarker: true }) as typeof fetch), document, c, { threads: [] }, null)
    expect(replaced.pages).toEqual([])
    const partial = await readSyncSnapshot(commentClient(options, server({ failChildren: true }) as typeof fetch), document, c, { threads: [] }, null)
    expect(partial.pages.map((p) => p.nodeId)).toEqual(['second'])
    expect(partial.review.some((r) => r.reason.includes('403'))).toBe(true)
    await expect(readSyncSnapshot(commentClient(options, server() as typeof fetch), document, c, { threads: [] }, { version: 1, connection: { ...c, landingId: '9' }, entries: [], excluded: [] })).rejects.toThrow('different publication')
  })
  it('previews without side effects, refuses changed confirmation, applies an import and exposes status through CLI', async () => {
    const d = await folder()
    for (const [path, content] of Object.entries(serializeToMdFolder(data, 'Test'))) { await mkdir(dirname(join(d, path)), { recursive: true }); await writeFile(join(d, path), content) }
    vi.stubEnv('CONFLUENCE_EMAIL', options.email); vi.stubEnv('CONFLUENCE_API_TOKEN', options.token)
    const request = server(); vi.stubGlobal('fetch', request)
    let out = '', err = ''
    const run = async (...args: string[]) => { out = ''; err = ''; return main(['discussions', 'confluence', ...args], { cwd: d, out: (t) => { out += t }, err: (t) => { err += t } }) }
    const args = ['connect', '--view', 'wiki', '--page', `${options.url}/wiki/pages/viewpage.action?pageId=1`, '--json']
    expect(await run(...args)).toBe(1) // retained-page exclusion requires review
    const preview = JSON.parse(out)
    expect(preview.imports).toBe(1)
    expect((await readdir(d)).some((p) => p.startsWith('discussions'))).toBe(false)
    expect(await run(...args, '--apply', '--expect', 'stale-token')).toBe(2)
    expect(err).toContain('changed since preview')
    expect((await readdir(d)).some((p) => p.startsWith('discussions'))).toBe(false)
    expect(await run(...args, '--apply', '--expect', preview.token)).toBe(1)
    expect(JSON.parse(out)).toMatchObject({ imported: 1, sent: 0 })
    expect((await new DiskDiscussions(d).load()).threads[0].nodeId).toBe('first')
    expect(await run('status')).toBe(1)
    expect(JSON.parse(out).lastResult.imported).toBe(1)
    expect(await run('sync', '--json')).toBe(1)
    expect(JSON.parse(out)).toMatchObject({ imports: 0, sends: 0 })
    expect(request.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true)
  })
})

describe('original identity and header pagination', () => {
  it('reads Link-only pagination without dropping pages', async () => {
    const request = vi.fn(async (url: string | URL | Request) => String(url).includes('cursor=last') ? Response.json({ results: [remote('11')] }) : Response.json({ results: [remote()] }, { headers: { Link: '</wiki/api/v2/pages/2/footer-comments?cursor=last>; rel="next"' } }))
    expect((await commentClient(options, request as typeof fetch).list('/pages/2/footer-comments')).length).toBe(2)
  })
  it('uses version 1 author and timestamp instead of attributing an existing edited comment to its editor', async () => {
    const original = remote()
    const edited = { ...original, version: { number: 2, authorId: 'editor', createdAt: '2026-10-31T12:00:00.000Z' } }
    const request = vi.fn(async (url: string | URL | Request) => String(url).includes('/pages/2/footer-comments') ? Response.json({ results: [edited] }) : String(url).includes('version=1') ? Response.json(original) : Response.json({ results: [] }))
    const comments = await commentClient(options, request as typeof fetch).comments('2')
    expect(comments[0]).toMatchObject({ authorId: original.version.authorId, createdAt: original.version.createdAt, version: { number: 2, authorId: 'editor' } })
  })
})

describe('nested create acknowledgement recovery', () => {
  it('checkpoints the returned ID and verifies the immediate parent when create reports the thread root', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), t = thread(), s = snapshot([])
    const child = { id: randomUUID(), parentCommentId: t.comments[0].id, body: 'First reply', createdAt: t.comments[0].createdAt }
    const grandchild = { id: randomUUID(), parentCommentId: child.id, body: 'Nested reply', createdAt: child.createdAt }
    t.comments.push(child, grandchild); s.local.threads.push(t)
    await writeFile(join(d, 'discussions.json'), JSON.stringify(s.local)); await file.load()
    let creates = 0
    const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') {
        creates++
        return Response.json({ id: String(20 + creates), pageId: '2', ...(creates > 1 ? { parentCommentId: '21' } : {}), version: { number: 1 } })
      }
      expect(String(url)).toContain('/footer-comments/23?body-format=storage')
      const staged = (await new JournalFile(d).load())!.entries.find((e) => e.localId === grandchild.id)!
      expect(staged).toMatchObject({ state: 'uncertain', remoteId: '23', parentRemoteId: '22' })
      expect(staged.payload).toBeDefined()
      return Response.json({ ...remote('23', '22'), body: { storage: { value: markdownToStorage(grandchild.body) } } })
    })
    expect(await applySync(s, commentClient(options, request as typeof fetch), disk, file)).toEqual({ imported: 0, sent: 3, review: 0 })
    expect(creates).toBe(3)
    expect(request).toHaveBeenCalledTimes(4)
    expect((await file.load())!.entries[2]).toMatchObject({ state: 'linked', remoteId: '23', parentRemoteId: '22' })
  })
  it('retains the acknowledged ID and permits binding that same ID after read-back failure', async () => {
    const d = await folder(), disk = new DiskDiscussions(d), file = new JournalFile(d), t = thread(), s = snapshot([])
    s.local.threads.push(t); await writeFile(join(d, 'discussions.json'), JSON.stringify(s.local)); await file.load()
    let creates = 0
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') { creates++; return Response.json({ id: '21', pageId: 'wrong-page', version: { number: 1 } }) }
      return new Response('', { status: 503 })
    })
    expect((await applySync(s, commentClient(options, request as typeof fetch), disk, file)).review).toBe(1)
    const journal = (await file.load())!
    expect(journal.entries[0]).toMatchObject({ state: 'uncertain', remoteId: '21' })
    const updated = { ...s, journal, pages: [{ ...s.pages[0], comments: [remote('21')] }] }
    await recoverSync(updated, client(), file, t.comments[0].id, '21')
    expect((await file.load())!.entries[0]).toMatchObject({ state: 'linked', remoteId: '21' })
    expect(creates).toBe(1)
  })
})
