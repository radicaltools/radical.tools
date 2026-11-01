import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { deserializeFromMdFolder, isValidMdFolderManifest } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { DiskDiscussions } from '@radical/node-files/discussions'
import { confluenceBase } from './confluence'
import { commentClient } from './confluenceComments'
import { JournalFile, lockSync } from './discussionJournal'
import { applySync, previewSync, readSyncSnapshot, recoverSync } from './discussionSync'
import { exportWiki } from './wikiExport'
import type { Io } from './check'

export const DISCUSSIONS_USAGE = `Usage: radical discussions confluence connect|sync|status [folder] [options]

Manual, experimental Confluence Cloud footer discussion sync for a managed wiki tree.
  --view <id-or-name>  selected wiki (required when connecting)
  --page <url>         managed landing page URL (required when connecting)
  --node <node-id>      limit this run to selected nodes; repeat as needed
  --apply              confirm and apply the current preview
  --expect <token>     token from a reviewed preview (required with --apply)
  --exclude <id>       persist exclusion: local:<thread-uuid> or remote:<comment-id>
                       repeat for multiple exclusions; descendants are excluded too
  --bind <local=remote> recover an uncertain post by binding a verified remote ID
  --retry <local-id>   retry only after checking Confluence for the uncertain post
  --json              structured preview/results

Preview is read-only. Run again with --apply --expect <preview-token> after review.
Apply reads both sides again and refuses a changed snapshot. Existing conversations
stay separate. All supported existing footer comments are imported. Outbound posts
use the connected account; stored local email addresses are never exported.
No inline comments, edits, deletions or resolution sync. Keep one designated runner.
Back up/transfer discussions.json, discussions-confluence-sync.json and
 discussions-confluence-connection.json together. Version 2 imported discussions
require an updated Studio. Live editor compatibility has not yet been verified.
Credentials: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN (environment only).
Exit: 0 success, 1 review/partial result, 2 operational error.`

export function landingConnection(input: string): { site: string; landingId: string } {
  const u = new URL(input)
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.atlassian.net') || u.username || u.password || u.port || u.hash) throw new Error('Use a Confluence Cloud landing page HTTPS URL without credentials or fragment.')
  const landingId = /^\/wiki\/spaces\/[^/]+\/pages\/(\d+)(?:\/[^/]*)?\/?$/.exec(u.pathname)?.[1] ?? (u.pathname === '/wiki/pages/viewpage.action' ? u.searchParams.get('pageId') : null)
  if (!landingId || !/^\d+$/.test(landingId) || [...u.searchParams.keys()].some((k) => k !== 'pageId')) throw new Error('Use a managed landing-page URL, not a site or node-page URL.')
  return { site: confluenceBase(u.origin), landingId }
}
export async function discussionsCommand(args: string[], io: Io): Promise<number> {
  if (args.includes('--help') || args.includes('-h') || !args.length) { io.out(DISCUSSIONS_USAGE); return 0 }
  let release: (() => Promise<void>) | undefined
  try {
    const [provider, command, ...rest] = args
    if (provider !== 'confluence' || !['connect', 'sync', 'status'].includes(command)) throw new Error(DISCUSSIONS_USAGE)
    const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: {
      view: { type: 'string' }, page: { type: 'string' }, apply: { type: 'boolean' }, expect: { type: 'string' }, json: { type: 'boolean' },
      node: { type: 'string', multiple: true }, exclude: { type: 'string', multiple: true }, bind: { type: 'string' }, retry: { type: 'string' },
    } })
    if (positionals.length > 1) throw new Error('Choose one model folder.')
    if (values.apply && !values.expect) throw new Error('Review a preview first, then use --apply --expect <token>.')
    if ((values.bind && values.retry) || ((values.bind || values.retry) && command !== 'sync')) throw new Error('Use one recovery operation with sync.')
    const exclusions = values.exclude ?? []
    if (exclusions.some((e) => !/^(local:[0-9a-f-]{36}|remote:\d+)$/i.test(e))) throw new Error('Exclusions must be local:<thread-uuid> or remote:<comment-id>.')
    const root = await realpath(resolve(io.cwd, positionals[0] ?? '.'))
    if (values.apply) release = await lockSync(root)
    const file = new JournalFile(root), journal = await file.load()
    if (command === 'status') {
      io.out(JSON.stringify(journal ? { connection: journal.connection, lastResult: journal.lastResult, pending: journal.entries.filter((e) => e.state !== 'linked').map((e) => ({ localId: e.localId, state: e.state, pageId: e.pageId })), excluded: journal.excluded } : { connected: false }, null, 2))
      return journal?.entries.some((e) => e.state !== 'linked') || journal?.lastResult?.review ? 1 : 0
    }
    if (!journal && command !== 'connect') throw new Error('No connection. Use connect with --view and --page.')
    if (command === 'connect' && journal) throw new Error('Already connected. Use sync; do not regenerate the connection.')
    const files = await new MdFolderSession(diskFolderStorage(root)).readAll()
    if (!isValidMdFolderManifest(files['radical.md'])) throw new Error('Not a Radical Markdown folder.')
    const data = deserializeFromMdFolder(files).data
    const selection = values.view ?? journal?.connection.viewId
    const views = (data.views ?? []).filter((v) => v.kind === 'wiki')
    const view = views.find((v) => v.id === selection) ?? (views.filter((v) => v.name === selection).length === 1 ? views.find((v) => v.name === selection) : undefined)
    if (!view) throw new Error('Choose an exact wiki view ID or unambiguous name with --view.')
    const document = exportWiki(data, view, {})
    const destination = values.page ? landingConnection(values.page) : journal?.connection
    if (!destination) throw new Error('--page is required to connect a managed landing page.')
    const connection = { site: destination.site, landingId: destination.landingId, viewId: document.viewId, marker: document.marker }
    const email = process.env.CONFLUENCE_EMAIL, token = process.env.CONFLUENCE_API_TOKEN
    if (!email || !token) throw new Error('Set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN in the environment. Never put tokens in command arguments or files.')
    const client = commentClient({ url: connection.site, email, token })
    const disk = new DiskDiscussions(root)
    const snapshot = await readSyncSnapshot(client, document, connection, await disk.load(), journal, values.node ? new Set(values.node) : undefined)
    const preview = previewSync(snapshot, exclusions)
    if (!values.apply) {
      io.out(values.json ? JSON.stringify(preview, null, 2) : `${preview.limits}\n\nAccount: ${preview.account}\nPreview: import ${preview.imports}, send ${preview.sends}; ${preview.excluded} excluded, ${preview.review.length} need review.\n${preview.pages.map((p) => `${p.node}: ${p.url}`).join('\n')}\n${preview.review.map((r) => `${r.reason}${r.url ? ` ${r.url}` : ''}`).join('\n')}\n\nAfter review, repeat this command with --apply --expect ${preview.token}`)
      return preview.review.length || preview.excluded ? 1 : 0
    }
    if (preview.token !== values.expect) throw new Error('The model, discussions, connection, exclusions or remote snapshot changed since preview. Review a fresh preview; nothing was applied.')
    if (values.bind || values.retry) {
      const parts = values.bind?.split('=')
      if (parts && (parts.length !== 2 || !/^\d+$/.test(parts[1]))) throw new Error('--bind requires local-uuid=remote-comment-id.')
      await recoverSync(snapshot, client, file, parts?.[0] ?? values.retry!, parts?.[1])
      io.out('Recovery recorded. Run sync again to review remaining work.'); return 1
    }
    const result = await applySync(snapshot, client, disk, file, exclusions)
    io.out(values.json ? JSON.stringify(result) : result.imported || result.sent || result.review || preview.excluded ? `Imported ${result.imported}, sent ${result.sent}; ${result.review} need review, ${preview.excluded} excluded. Run preview for details and recovery links.` : 'Discussions are up to date.')
    return result.review || preview.excluded ? 1 : 0
  } catch (e) { io.err(`radical discussions confluence: ${(e as Error).message}`); return 2 }
  finally { await release?.() }
}
