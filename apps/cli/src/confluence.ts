import { realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { deserializeFromMdFolder, isValidMdFolderManifest } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { exportWiki, type WikiExport } from './wikiExport'
import { publishTree } from './confluenceTree'
import type { Io } from './check'

export const EXPORT_USAGE = `Usage: radical export confluence [folder] --view <id-or-name> [options]

Export a selected wiki view. Radical remains the source of truth.
Export a document locally, or publish a browsable page tree to Confluence.

  folder                 Radical Markdown folder (default: working directory)
  --view <id-or-name>     wiki view to export (exact ID or unambiguous name)
  --list-views           list the available wiki views
  --format <format>      storage (default), markdown, or html (browser preview)
  --output <file>        write a new file outside the model; otherwise stdout
  --title <title>        override the document / Confluence page title
  --source-url <url>     link back to the source model or wiki
  --publish              publish to Confluence Cloud; otherwise export locally
  --structure <mode>     tree (default) or document when publishing
  --url <url>            Confluence site URL (or CONFLUENCE_URL)
  --token-env <name>     token environment variable (default: CONFLUENCE_API_TOKEN)
  --space-id <id>        destination space ID (required unless --page-id)
  --parent-id <id>       create or move the managed export under this page
  --page-id <id>         refresh an existing page exported from this wiki

Publishing reads CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN from the environment.
An existing page is updated only when it carries this wiki's export marker.
Publishing replaces its generated body, including any edits made in Confluence.
No source model files are written. Exit status: 0 success, 2 could not export.`

export interface Page { id: string; title: string; spaceId: string; status: string; parentId?: string; version: { number: number }; body?: { storage?: { value?: string } } }
export interface PublishOptions { url: string; email: string; token: string; spaceId?: string; parentId?: string; pageId?: string }

export function confluenceBase(input: string): string {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Invalid Confluence URL. Use https://company.atlassian.net.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/', '/wiki', '/wiki/'].includes(url.pathname)) {
    throw new Error('Use an HTTPS Confluence site URL, optionally ending in /wiki, without credentials, query or fragment.')
  }
  return `${url.origin}/wiki`
}

export function confluenceClient(options: PublishOptions, request: typeof fetch = fetch) {
  const base = confluenceBase(options.url)
  const authorization = `Basic ${Buffer.from(`${options.email}:${options.token}`).toString('base64')}`
  const api = async (path: string, method = 'GET', body?: unknown): Promise<unknown> => {
    let response: Response
    try {
      for (let attempt = 0; ; attempt++) {
        response = await request(`${base}/api/v2${path}`, {
          method, redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        if (response.status !== 429 || attempt >= 3) break
        const retry = response.headers.get('retry-after')
        const seconds = retry === null ? 2 ** attempt : Number(retry)
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30) break
        await delay(seconds * 1000)
      }
    } catch { throw new Error('Cannot reach Confluence. Check the site URL and network. If a write timed out, check Confluence before retrying.') }
    if (!response.ok) {
      const hint = response.status === 401 ? 'Check CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN.'
        : response.status === 403 ? 'The account needs permission to read and create/update pages in this space.'
        : response.status === 404 ? 'Check the page and space IDs and the account permissions.'
        : response.status === 409 ? 'The page changed during publication. Review it before retrying.'
        : response.status === 429 ? 'Confluence rate limit reached. Retry later.' : 'Check the destination, title and page size.'
      // Do not reflect response bodies: proxies and servers may echo credentials.
      throw new Error(`Confluence returned HTTP ${response.status}. ${hint}`)
    }
    try { return await response.json() } catch { throw new Error('Confluence returned an invalid JSON response. Check the destination before retrying.') }
  }
  return { base, api }
}

export function hasWikiMarker(storage: string, marker: string): boolean {
  return new RegExp(`<ac:parameter\\s+ac:name=["']{2}>${marker}</ac:parameter>`).test(storage)
}

/** One managed document, also used for a tree's landing page. */
export async function publishWiki(document: WikiExport, options: PublishOptions, request: typeof fetch = fetch): Promise<{ id: string; url: string; action: 'created' | 'updated' }> {
  const { base, api } = confluenceClient(options, request)
  let pageId = options.pageId
  if (!pageId) {
    if (!options.spaceId) throw new Error('--space-id is required when creating a page.')
    const query = new URLSearchParams({ 'space-id': options.spaceId, title: document.title, status: 'current', limit: '2' })
    const found = await api(`/pages?${query}`) as { results?: Page[]; _links?: { next?: string } }
    if (!Array.isArray(found.results)) throw new Error('Confluence returned an invalid page list.')
    if (found.results.length > 1 || found._links?.next) throw new Error('More than one page matches this title. Use --page-id to select a managed page.')
    pageId = found.results[0]?.id
  }
  const body = { representation: 'storage', value: document.storage }
  let saved: Page
  if (pageId) {
    const current = await api(`/pages/${encodeURIComponent(pageId)}?body-format=storage`) as Page
    if (current.id !== pageId || current.status !== 'current' || !Number.isInteger(current.version?.number)) throw new Error('Confluence returned an invalid or unpublished destination page.')
    if (options.spaceId && current.spaceId !== options.spaceId) throw new Error('The destination page belongs to a different space.')
    // XML quote style can change during a Confluence save; the generated marker remains.
    if (!hasWikiMarker(current.body?.storage?.value ?? '', document.marker)) {
      throw new Error('The destination is not a managed export of this wiki. Choose a new title or the correct --page-id; no page was changed.')
    }
    saved = await api(`/pages/${encodeURIComponent(pageId)}`, 'PUT', {
      id: pageId, status: 'current', title: document.title, body,
      ...(options.parentId ? { parentId: options.parentId } : {}),
      version: { number: current.version.number + 1, message: 'Published from Radical; Radical remains the source of truth.' },
    }) as Page
  } else {
    saved = await api('/pages', 'POST', { spaceId: options.spaceId, ...(options.parentId ? { parentId: options.parentId } : {}), title: document.title, status: 'current', body }) as Page
  }
  if (typeof saved.id !== 'string' || !/^\d+$/.test(saved.id)) throw new Error('Confluence returned no page ID. Check the destination before retrying.')
  return { id: saved.id, url: `${base}/pages/viewpage.action?pageId=${saved.id}`, action: pageId ? 'updated' : 'created' }
}

export async function exportCommand(args: string[], io: Io): Promise<number> {
  if (args[0] !== 'confluence') {
    const help = args.length === 0 || args[0] === '--help' || args[0] === '-h'
    ;(help ? io.out : io.err)(EXPORT_USAGE)
    return help ? 0 : 2
  }
  try {
    const { values, positionals } = parseArgs({ args: args.slice(1), allowPositionals: true, options: {
      view: { type: 'string' }, 'list-views': { type: 'boolean' }, format: { type: 'string', default: 'storage' }, output: { type: 'string', short: 'o' },
      title: { type: 'string' }, 'source-url': { type: 'string' }, publish: { type: 'boolean' }, url: { type: 'string' },
      'token-env': { type: 'string', default: 'CONFLUENCE_API_TOKEN' },
      structure: { type: 'string', default: 'tree' },
      'space-id': { type: 'string' }, 'parent-id': { type: 'string' }, 'page-id': { type: 'string' }, help: { type: 'boolean', short: 'h' },
    } })
    if (values.help) { io.out(EXPORT_USAGE); return 0 }
    if (positionals.length > 1 || !['storage', 'markdown', 'html'].includes(values.format) || !['tree', 'document'].includes(values.structure)) throw new Error(EXPORT_USAGE)
    if (!values['list-views'] && !values.view?.trim()) throw new Error('--view is required. Use --list-views to find wiki views.')
    if (values.title !== undefined && !values.title.trim()) throw new Error('--title cannot be empty.')
    if (values['source-url']) {
      const source = new URL(values['source-url'])
      if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password) throw new Error('--source-url must be an HTTP(S) URL without credentials.')
    }
    for (const key of ['space-id', 'parent-id', 'page-id'] as const) if (values[key] !== undefined && !/^\d+$/.test(values[key]!)) throw new Error(`--${key} must be a numeric Confluence ID.`)
    if (values['parent-id'] && !values['space-id'] && !values['page-id']) throw new Error('--parent-id requires --space-id or --page-id.')
    if (!values.publish && (values['space-id'] || values['page-id'] || values['parent-id'] || values.url)) throw new Error('Add --publish to use a Confluence destination, or omit destination options for a local export.')
    const root = await realpath(resolve(io.cwd, positionals[0] ?? '.'))
    const files = await new MdFolderSession(diskFolderStorage(root)).readAll()
    if (!isValidMdFolderManifest(files['radical.md'])) throw new Error('Not a Radical Markdown model folder: missing or invalid radical.md.')
    const data = deserializeFromMdFolder(files).data
    const views = (data.views ?? []).filter((v) => v.kind === 'wiki')
    if (values['list-views']) {
      if (values.publish || values.output || values.view) throw new Error('--list-views cannot be combined with --publish, --output or --view.')
      io.out(views.map((v) => `${v.id}\t${v.name}`).join('\n') || 'No wiki views in this model.')
      return 0
    }
    const byId = views.find((v) => v.id === values.view)
    const matches = byId ? [byId] : views.filter((v) => v.name === values.view)
    if (matches.length !== 1) throw new Error(matches.length ? 'Several wiki views have that name. Select one by ID.' : `Wiki view not found. Use --list-views to find its name or ID.`)
    const document = exportWiki(data, matches[0], { title: values.title, sourceUrl: values['source-url'] })
    let publication: PublishOptions | undefined
    if (values.publish) {
      const url = values.url ?? process.env.CONFLUENCE_URL
      const email = process.env.CONFLUENCE_EMAIL
      const token = process.env[values['token-env']]
      if (!url || !email || !token) throw new Error(`Publishing requires CONFLUENCE_URL (or --url), CONFLUENCE_EMAIL and the token in ${values['token-env']}.`)
      confluenceBase(url)
      if (!values['space-id'] && !values['page-id']) throw new Error('Publishing requires --space-id or --page-id.')
      publication = { url, email, token, spaceId: values['space-id'], parentId: values['parent-id'], pageId: values['page-id'] }
    }
    if (values.output) {
      const path = resolve(io.cwd, values.output)
      const parent = await realpath(dirname(path))
      const actual = resolve(parent, basename(path))
      if (actual === root || actual.startsWith(root + sep)) throw new Error('--output must be outside the source model folder.')
      await writeFile(actual, document[values.format as 'storage' | 'markdown' | 'html'], { encoding: 'utf8', flag: 'wx' })
      io.err(`Exported ${document.elementCount} elements to ${values.output}.`)
    } else if (!publication) io.out(document[values.format as 'storage' | 'markdown' | 'html'])
    for (const warning of document.warnings) io.err(`Warning: ${warning}`)
    if (publication) {
      const result = values.structure === 'tree'
        ? await publishTree(document, publication, fetch, (message) => io.err(message))
        : await publishWiki(document, publication)
      io.out(`${result.action === 'created' ? 'Created' : 'Updated'} Confluence page ${result.id}: ${result.url}`)
    }
    return 0
  } catch (error) {
    io.err(`radical export confluence: ${(error as Error).message}`)
    return 2
  }
}
