// ─── Radical Assay: sources besides the code ─────────────────────────────────
//
// What a system's people wrote about it is evidence of intent (ADR Radical
// Assay, sources besides the code): a folder, a .zip file or a public link
// given to a run. Each document is kept as text in the central repository's
// .radical/assay/sources/<name>/, so a citation of it is checked as quoted
// code is, and listed as a document fact with its title and headings. A link
// is fetched once, with no credentials and from no private address: one that
// asks for a login is refused. Nothing a source or an archive names is
// trusted with where its files go: every write and every emptied folder is
// checked to lie inside its own folder. A repository's own README, docs and
// ADR records are document facts too, read where they are.

import { randomUUID } from 'node:crypto'
import { lookup as lookupCallback } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { Parser } from 'htmlparser2'
import { emptyFacts, type DocumentFact, type RepositoryFacts } from './facts'
import { SKIPPED, decodeText, posix, type RepoFiles } from './files'

/** Where the central repository keeps the run's copies of documents, and the code of .zip files. */
export const SOURCES_DIR = '.radical/assay/sources'
export const UNPACKED_DIR = '.radical/assay/unpacked'

/** Kept as they are. */
const TEXT = /\.(md|markdown|mdx|txt|text|adoc|asciidoc|rst|ya?ml|json|xml|sql|wsdl|xsd|graphql|gql|proto|csv|ini|properties|toml|feature|puml|plantuml|dot|mmd)$/i
const HTML = /\.(html?|xhtml)$/i
const PDF = /\.pdf$/i
/** Whose headings are read: Markdown's and plain text's #, AsciiDoc's =. */
const MARKDOWN = /(\.(md|markdown|mdx|txt|text)|(^|\/)[^./]+)$/i
const ASCIIDOC = /\.(adoc|asciidoc)$/i
/** A document Assay reads in a repository: a README or changelog of any name (README!!.txt, Changelog-server.txt), or a document of a docs or decisions folder. */
const REPOSITORY_DOCUMENT = /(^|\/)(read[_ -]?me[^/]*|changelog|changes|history|leeme|warning)([^/]*\.(md|markdown|txt|adoc|rst))?$|(^|\/)(docs?|documentation|adrs?|decisions|architecture)\/(.+\/)?[^/]+\.(md|markdown|adoc|asciidoc|rst|txt)$/i
const FIXTURE = /(^|\/)(tests?|__tests__|fixtures?|testdata)\//i
/** A link's answer, a file of a source, or all of a .zip file's contents, bigger than this is not taken. */
const MAX_BYTES = 50_000_000
/** At most this many files of a source are kept; the rest are named as left out. */
const MAX_FILES = 5_000
/** A PDF that takes longer than this to read is left out. */
const PDF_TIMEOUT = 60_000
const MAX_HEADINGS = 60
const MAX_REDIRECTS = 5

/** True when `path` lies inside `dir` (not `dir` itself). */
export function within(dir: string, path: string): boolean {
  const rel = relative(dir, path)
  return !!rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${'/'}`) && !rel.startsWith('..\\')
}

/** A file or folder name to keep: no separators or control characters, and
 *  not made only of dots; `fallback` when nothing is left. */
export function safeName(name: string, fallback: string): string {
  const clean = name.replace(/[\/\\\u0000-\u001f<>:"|?*]+/g, '-').replace(/^[-\s]+|[-\s]+$/g, '').slice(0, 80)
  return /^\.*$/.test(clean) ? fallback : clean
}

/** The headings of a document's text: Markdown's (outside code blocks) for
 *  Markdown and plain text, AsciiDoc's for AsciiDoc; none for other formats,
 *  whose # lines are comments. */
export function headingsOf(text: string, file = 'x.md'): DocumentFact['headings'] {
  const adoc = ASCIIDOC.test(file)
  const marker = adoc ? /^(={1,6})\s+(.+?)\s*$/ : MARKDOWN.test(file) ? /^(#{1,6})\s+(.+?)\s*#*\s*$/ : null
  if (!marker) return []
  const out: DocumentFact['headings'] = []
  // A code block: Markdown's ``` or ~~~ fence (with its language), closed by
  // the same marker at least as long; AsciiDoc's ---- or .... delimiters.
  let fence: string | null = null
  text.split(/\r?\n/).forEach((line, i) => {
    const open = (adoc ? /^(-{4,}|\.{4,})\s*$/ : /^\s{0,3}(`{3,}|~{3,})/).exec(line)
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && (adoc || /^\s*[`~]+\s*$/.test(line))) fence = null
      return
    }
    if (open) { fence = open[1]; return }
    if (out.length >= MAX_HEADINGS) return
    const m = marker.exec(line)
    if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 })
  })
  return out
}

/** A document fact of `file`, a file of the repository or source `repository`. */
export function documentFact(repository: string, file: string, text: string, origin?: string): DocumentFact {
  const headings = headingsOf(text, file)
  const name = basename(file).replace(/(\.(html?|xhtml|pdf))?\.(md|txt)$/i, '').replace(/\.[^.]+$/, '')
  const title = (headings.find((h) => h.level === 1) ?? headings[0])?.text ?? name
  return { id: `${repository}:doc:${file}`, file, title, headings, ...(origin ? { origin } : {}), evidence: { file, line: (headings.find((h) => h.text === title)?.line) ?? 1 } }
}

/** The documents of a repository of code, read where they are. */
export function readDocuments(files: RepoFiles, repo: string): DocumentFact[] {
  return files.list
    .filter((f) => REPOSITORY_DOCUMENT.test(f) && !FIXTURE.test(f))
    .map((f) => documentFact(repo, f, files.read(f)))
}

// ─── HTML as Markdown ────────────────────────────────────────────────────────

const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'template', 'head', 'iframe', 'object'])
const BLOCK = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'ul', 'ol', 'table', 'blockquote', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'form', 'fieldset', 'details', 'summary', 'hr'])

/** An HTML page's text as Markdown: its headings as #, its list items as -,
 *  its table cells split by |, its preformatted text kept; scripts, styles
 *  and markup left out. The page's title leads when no h1 does. */
export function htmlToMarkdown(html: string): string {
  const out: string[] = []
  let line = ''
  let skip = 0
  let pre = 0
  let title = ''
  let inTitle = false
  let h1 = false
  const flush = (): void => {
    const text = pre ? line : line.replace(/[ \t]+/g, ' ').trim()
    if (text) out.push(text)
    line = ''
  }
  const blank = (): void => { flush(); if (out.length && out[out.length - 1] !== '') out.push('') }
  const parser = new Parser({
    onopentag(name) {
      if (name === 'title') { inTitle = true; return }
      if (SKIP.has(name)) { skip++; return }
      if (skip) return
      const h = /^h([1-6])$/.exec(name)
      if (h) { blank(); line = `${'#'.repeat(Number(h[1]))} `; if (h[1] === '1') h1 = true; return }
      if (name === 'pre') { blank(); out.push('```'); pre++; return }
      if (name === 'li') { flush(); line = '- '; return }
      if (name === 'tr') { flush(); return }
      if (name === 'br') { flush(); return }
      if (name === 'td' || name === 'th') { line += line ? ' | ' : ''; return }
      if (BLOCK.has(name)) blank()
    },
    ontext(text) {
      if (inTitle) { title += text; return }
      if (skip) return
      if (pre) {
        const parts = text.split('\n')
        line += parts[0]
        for (const part of parts.slice(1)) { out.push(line); line = part }
        return
      }
      line += text.replace(/\s+/g, ' ')
    },
    onclosetag(name) {
      if (name === 'title') { inTitle = false; return }
      if (SKIP.has(name)) { skip = Math.max(0, skip - 1); return }
      if (skip) return
      if (name === 'pre') { flush(); out.push('```', ''); pre = Math.max(0, pre - 1); return }
      if (/^h[1-6]$/.test(name)) { blank(); return }
      if (name === 'li' || name === 'tr') { flush(); return }
      if (BLOCK.has(name)) blank()
    },
  }, { decodeEntities: true })
  parser.write(html)
  parser.end()
  flush()
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const lead = title.replace(/\s+/g, ' ').trim()
  return `${!h1 && lead ? `# ${lead}\n\n` : ''}${text}\n`
}

// ─── Documents as text ───────────────────────────────────────────────────────

/** The text a PDF holds, page by page; refused after PDF_TIMEOUT. */
async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, fail) => { timer = setTimeout(() => fail(new Error(`not read within ${PDF_TIMEOUT / 1000} s`)), PDF_TIMEOUT) })
  try {
    const pdf = await Promise.race([getDocumentProxy(new Uint8Array(bytes)), late])
    const { text } = await Promise.race([extractText(pdf, { mergePages: false }), late])
    return (text as string[]).map((page, i) => `--- page ${i + 1} ---\n${page.trim()}`).join('\n\n') + '\n'
  } finally {
    clearTimeout(timer)
  }
}

/** A document's copy as text, by its name: the file it is kept as (an HTML
 *  page's as .md beside its name, a PDF's as .txt) and its text; null for a
 *  file that is no document Assay reads. */
export async function asText(name: string, bytes: Uint8Array): Promise<{ file: string; text: string } | null> {
  if (TEXT.test(name)) return { file: name, text: decodeText(bytes) }
  if (HTML.test(name)) return { file: `${name}.md`, text: htmlToMarkdown(decodeText(bytes)) }
  if (PDF.test(name)) return { file: `${name}.txt`, text: await pdfText(bytes) }
  return null
}

// ─── .zip files ──────────────────────────────────────────────────────────────

/** A path of an archive that is no file of what it holds: a folder, macOS's
 *  litter, or a .git folder, whose configuration git would run. */
const NO_FILE = /(^|\/)(__MACOSX\/|\.DS_Store$|\.git(\/|$))/i
const GIT_FOLDER = /^(.*?)(?:^|\/)\.git(\/|$)/i

export interface ZipFiles {
  /** The files by their paths. */
  files: Map<string, Uint8Array>
  /** The folders that held a .git folder: repositories, packed ('' for the archive's root). */
  repositories: string[]
}

/** The files of a .zip file by their paths, its .git folders left out (the
 *  folders that held one named); throws, naming it, at an entry that would
 *  land outside the folder it is unpacked into (or, on Windows, one no
 *  Windows file can be named). */
export function readZip(zip: string): ZipFiles {
  let total = 0
  const repositories = new Set<string>()
  const entries = unzipSync(readFileSync(zip), {
    filter: (f) => {
      const name = f.name.replace(/\\/g, '/')
      const git = GIT_FOLDER.exec(name)
      if (git) repositories.add(git[1].replace(/\/$/, ''))
      if (NO_FILE.test(name)) return false
      total += f.originalSize
      if (total > 10 * MAX_BYTES) throw new Error(`${basename(zip)} unpacks to more than ${(10 * MAX_BYTES) / 1e6} MB`)
      return true
    },
  })
  const files = new Map<string, Uint8Array>()
  for (const [raw, data] of Object.entries(entries)) {
    const name = raw.replace(/\\/g, '/')
    if (name.endsWith('/')) continue
    const parts = name.split('/')
    if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || parts.includes('..') || parts.some((p) => /^\.+$/.test(p) && p !== '.')) {
      throw new Error(`${basename(zip)}: entry ${raw} would land outside the folder it is unpacked into`)
    }
    if (process.platform === 'win32' && parts.some((p) => /[<>:"|?*\u0000-\u001f]|^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p))) {
      throw new Error(`${basename(zip)}: entry ${raw} cannot be named on Windows`)
    }
    files.set(parts.filter((p) => p !== '.').join('/'), data)
  }
  // A repository inside another (a submodule) is read with it.
  const roots = [...repositories].filter((r) => !/(^|\/)\.\.?(\/|$)/.test(r)).sort()
  return { files, repositories: roots.filter((r) => !roots.some((o) => o !== r && (o === '' || r.startsWith(`${o}/`)))) }
}

/** Writes `files` into a fresh folder beside `into`, then puts it in `into`'s
 *  place: `into`, a strict child of `parent`, is replaced only when every
 *  write succeeded, and nothing lands outside it. */
function replaceFolder(parent: string, into: string, write: (dir: string) => void): void {
  if (!within(parent, into)) throw new Error(`${into} is not inside ${parent}`)
  const tag = randomUUID().slice(0, 8)
  const fresh = `${into}.new-${tag}`
  const old = `${into}.old-${tag}`
  mkdirSync(fresh, { recursive: true })
  try {
    write(fresh)
  } catch (error) {
    rmSync(fresh, { recursive: true, force: true })
    throw error
  }
  // The old copy is set aside, not removed, until the new one is in its place.
  const had = existsSync(into)
  if (had) renameSync(into, old)
  try {
    renameSync(fresh, into)
  } catch (error) {
    if (had) renameSync(old, into)
    rmSync(fresh, { recursive: true, force: true })
    throw error
  }
  if (had) rmSync(old, { recursive: true, force: true })
}

/** Writes `data` at `name` inside `dir`, or throws when the name leads out of it. */
function writeInside(dir: string, name: string, data: Uint8Array | string): void {
  const path = resolve(dir, name)
  if (!within(dir, path)) throw new Error(`${name} would land outside ${basename(dir)}`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

/** Unpacks a .zip file of code into `into`, a folder of `parent` (its .git
 *  folders left out), replacing what was there; returns the folders that
 *  were repositories ('' for the archive itself). */
export function unpackZip(zip: string, parent: string, into: string): string[] {
  const { files, repositories } = readZip(zip)
  replaceFolder(parent, into, (dir) => { for (const [name, data] of files) writeInside(dir, name, data) })
  return repositories
}

/** Keeps a folder of the central repository's .radical/assay/ out of git, unless the team chooses otherwise. */
export function ignored(dir: string): void {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, '.gitignore')
  if (!existsSync(file)) writeFileSync(file, '# Radical Assay\'s copies: kept out of git unless the team chooses otherwise.\n*\n')
}

// ─── Links ───────────────────────────────────────────────────────────────────

/** The eight 16-bit groups of an IPv6 address (with an IPv4 tail, if written so), or null. */
function groupsOf(address: string): number[] | null {
  let text = address.toLowerCase().replace(/%.*$/, '')
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number)
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, rest] = text.split('::')
  const left = head ? head.split(':') : []
  const right = rest !== undefined && rest ? rest.split(':') : []
  const fill = rest === undefined ? 0 : 8 - left.length - right.length
  const groups = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right].map((g) => parseInt(g, 16))
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null
}

/** Why an IPv4 address (as four numbers) is no public one, or null. */
function privateV4([a, b]: number[]): string | null {
  if (a === 127 || a === 0) return 'a loopback address'
  if (a === 169 && b === 254) return 'a link-local address'
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0)) return 'a private network address'
  if (a >= 224) return 'a multicast or reserved address'
  return null
}

/** Why `address` (an IP, either version) is no public one, or null. An IPv4
 *  address mapped into, or embedded in, IPv6 is judged as itself. */
export function privateAddress(address: string): string | null {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(address)
  if (v4) return privateV4(v4.slice(1).map(Number))
  const g = groupsOf(address)
  if (!g) return 'no address Assay can judge'
  const embedded = (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) || (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0))
  if (embedded && !(g[5] === 0 && g[6] === 0 && g[7] <= 1)) return privateV4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff])
  if (g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1)) return 'a loopback address'
  if ((g[0] & 0xffc0) === 0xfe80) return 'a link-local address'
  if ((g[0] & 0xfe00) === 0xfc00) return 'a private network address'
  if ((g[0] & 0xff00) === 0xff00) return 'a multicast or reserved address'
  return null
}

/** Why the host of `url` may not be fetched, or null: a loopback, link-local
 *  or private address, by name or as it resolves. */
async function privateHost(url: URL): Promise<string | null> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : await lookup(host, { all: true }).then((all) => all.map((a) => a.address), () => [])
  for (const address of addresses) {
    const why = privateAddress(address)
    if (why) return `${url.host} is ${why} (${address})`
  }
  return null
}

/** A connection's address lookup that refuses private addresses, so a name
 *  that resolved to a public address when checked cannot connect to a
 *  private one (DNS rebinding). */
export function guardedLookup(hostname: string, options: { all?: boolean; family?: number }, callback: (...args: unknown[]) => void): void {
  lookupCallback(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) { callback(error); return }
    for (const a of addresses) {
      const why = privateAddress(a.address)
      if (why) { callback(Object.assign(new Error(`${hostname} is ${why} (${a.address})`), { code: 'EASSAYPRIVATE' })); return }
    }
    if (options.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  })
}

const EXPORT_IT = 'Export its pages (PDF, HTML or Markdown) into a folder or a .zip file and give that instead: Assay holds no credentials.'
const SIGN_IN = /\/(log-?in|sign-?in|sso|saml|auth\/realms|oauth2?\/authorize)(\/|$)/i

/** The connections of guarded fetches, made once. */
let guarded: unknown

/** fetch, through a connection whose lookup refuses private addresses unless `open`. */
async function guardedFetch(url: URL, open: boolean | undefined, init: RequestInit): Promise<Response> {
  const { Agent, fetch: undiciFetch } = await import('undici')
  guarded ??= new Agent({ connect: { lookup: guardedLookup as never } })
  const dispatcher = open ? undefined : guarded
  try {
    return (await undiciFetch(url, { ...(init as object), ...(dispatcher ? { dispatcher } : {}) } as never)) as unknown as Response
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause
    if (cause?.code === 'EASSAYPRIVATE') throw Object.assign(new Error(cause.message), { private: true })
    throw error
  }
}

/** The body of `response`, read up to MAX_BYTES; null past it. */
async function bodyOf(response: Response): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES || !response.body) { await response.body?.cancel(); return declared > MAX_BYTES ? null : new Uint8Array() }
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.byteLength }
  return out
}

/** One document a link serves: its file name and bytes, or why it is not taken.
 *  Redirects are followed one by one, each target checked. */
async function fetchLink(start: URL, options: SourceOptions): Promise<{ name: string; bytes: Uint8Array; final: string } | { problem: string }> {
  let url = start
  let response: Response | undefined
  for (let hop = 0; ; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { problem: `${start.href} leads to ${url.href}, which is no http(s) link` }
    const refused = options.allowPrivate || options.allowHosts?.includes(url.host) ? null : await privateHost(url)
    if (refused) return { problem: `${start.href} is not fetched: ${refused}. Assay fetches only public links (RADICAL_ASSAY_PRIVATE_LINKS=1 allows others).` }
    if (hop > 0 && SIGN_IN.test(url.pathname)) return { problem: `${start.href} asks for a login: it leads to a sign-in page (${url.href}). ${EXPORT_IT}` }
    try {
      response = await guardedFetch(url, options.allowPrivate || options.allowHosts?.includes(url.host), {
        redirect: 'manual',
        headers: { accept: 'text/html,application/xhtml+xml,application/pdf,text/markdown,text/plain,application/json,application/yaml;q=0.9,*/*;q=0.5', 'user-agent': 'radical-assay' },
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      if ((error as { private?: boolean }).private) return { problem: `${start.href} is not fetched: ${(error as Error).message}. Assay fetches only public links (RADICAL_ASSAY_PRIVATE_LINKS=1 allows others).` }
      throw error
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel()
      if (hop >= MAX_REDIRECTS) return { problem: `${start.href} redirects more than ${MAX_REDIRECTS} times` }
      url = new URL(location, url)
      continue
    }
    break
  }
  if (response.status === 401 || response.status === 407) { await response.body?.cancel(); return { problem: `${start.href} asks for a login: it answers ${response.status}. ${EXPORT_IT}` } }
  if (response.status === 403) { await response.body?.cancel(); return { problem: `${start.href} answers 403: it may ask for a login, or turn robots away. ${EXPORT_IT}` } }
  if (!response.ok) { await response.body?.cancel(); return { problem: `${start.href} answers ${response.status}` } }
  const bytes = await bodyOf(response)
  if (!bytes) return { problem: `${start.href} is bigger than ${MAX_BYTES / 1e6} MB` }
  const type = (response.headers.get('content-type') ?? '').toLowerCase()
  if (type.includes('html') && /<input[^>]+type\s*=\s*["']?password/i.test(decodeText(bytes.subarray(0, 200_000)))) {
    return { problem: `${start.href} asks for a login: it shows a sign-in form. ${EXPORT_IT}` }
  }
  let last = url.pathname.split('/').pop() || 'index'
  try { last = decodeURIComponent(last) } catch { /* kept as written */ }
  last = safeName(last, 'index')
  const ext = type.includes('html') ? '.html' : type.includes('pdf') ? '.pdf' : type.includes('markdown') ? '.md'
    : type.includes('json') ? '.json' : type.includes('yaml') ? '.yaml' : type.includes('xml') ? '.xml' : type.startsWith('text/') ? '.txt' : extname(last)
  const name = extname(last).toLowerCase() === ext ? last : `${last.replace(/\.[^.]*$/, '') || 'index'}${ext}`
  return { name, bytes, final: url.href }
}

/** A name for a link's source: its host and path, as a folder's name. */
const linkName = (url: URL): string =>
  safeName(`${url.hostname}${url.pathname}`.replace(/\.(html?|pdf|md)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-'), url.hostname || 'link').slice(0, 60)

// ─── Sources ─────────────────────────────────────────────────────────────────

/** The files of a folder, or of one file given on its own, as paths from the
 *  folder: hidden folders and what builds make left out, symbolic links not
 *  followed, at most MAX_FILES; the rest counted. */
function folderFiles(path: string): { files: Array<{ name: string; full: string; size: number }>; more: number } {
  const stat = statSync(path)
  if (stat.isFile()) return { files: [{ name: basename(path), full: path, size: stat.size }], more: 0 }
  const files: Array<{ name: string; full: string; size: number }> = []
  let more = 0
  const walk = (dir: string): void => {
    for (const d of readdirSync(join(path, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (d.name.startsWith('.') || (d.isDirectory() && SKIPPED.has(d.name))) continue
      const rel = dir ? `${dir}/${d.name}` : d.name
      if (d.isDirectory()) walk(rel)
      else if (d.isFile()) {
        if (files.length >= MAX_FILES) { more++; continue }
        files.push({ name: rel, full: join(path, rel), size: statSync(join(path, rel)).size })
      }
    }
  }
  walk('')
  return { files, more }
}

/** What a source given as `spec` is taken from, as takeSources names it: the link, or the real path. */
export function sourceOrigin(spec: string, root: string): string {
  if (/^https?:\/\//i.test(spec)) return spec
  const path = resolve(root, spec)
  return existsSync(path) ? realpathSync(path) : path
}

export interface TakenSources {
  sources: RepositoryFacts[]
  /** Sources not taken, each with why. */
  problems: string[]
}

export interface SourceOptions {
  /** Fetch links of loopback, link-local and private addresses too (RADICAL_ASSAY_PRIVATE_LINKS=1). */
  allowPrivate?: boolean
  /** Hosts fetched although their addresses are private (a test's own server). */
  allowHosts?: string[]
}

/** Takes the sources `given` (folders, files, .zip files, relative to `root`,
 *  or public http(s) links) into `root`'s SOURCES_DIR, each under a name
 *  none of `taken` has (case aside). A source's earlier copy is replaced
 *  only when the new one is taken. */
export async function takeSources(given: string[], root: string, taken: Set<string>, options: SourceOptions = {}): Promise<TakenSources> {
  const sources: RepositoryFacts[] = []
  const problems: string[] = []
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  const unique = (name: string): string => {
    let out = name
    for (let i = 2; lower.has(out.toLowerCase()); i++) out = `${name}-${i}`
    lower.add(out.toLowerCase())
    taken.add(out)
    return out
  }
  const parent = join(root, SOURCES_DIR)
  for (const spec of given) {
    try {
      const source = await takeSource(spec, root, parent, unique, options)
      if ('problem' in source) { problems.push(source.problem); continue }
      sources.push(source.facts)
    } catch (error) {
      problems.push(`${spec} is not taken: ${(error as Error).message.split('\n')[0]}`)
    }
  }
  return { sources, problems }
}

async function takeSource(spec: string, root: string, parent: string, unique: (name: string) => string, options: SourceOptions): Promise<{ facts: RepositoryFacts } | { problem: string }> {
  let files: Array<{ name: string; bytes: () => Uint8Array; size: number; origin: string }>
  let name: string
  let origin = spec
  let more = 0
  if (/^https?:\/\//i.test(spec)) {
    let url: URL
    try { url = new URL(spec) } catch { return { problem: `${spec} is no link` } }
    const got = await fetchLink(url, options)
    if ('problem' in got) return got
    name = linkName(url)
    files = [{ name: got.name, bytes: () => got.bytes, size: got.bytes.byteLength, origin: got.final }]
  } else {
    const given = resolve(root, spec)
    if (!existsSync(given)) return { problem: `${spec} does not exist` }
    const path = realpathSync(given)
    origin = path
    if (statSync(path).isFile() && /\.zip$/i.test(path)) {
      const entries = readZip(path).files
      files = [...entries].map(([n, data]) => ({ name: n, bytes: () => data, size: data.byteLength, origin: `${basename(path)}/${n}` }))
      name = basename(path).replace(/\.zip$/i, '')
    } else {
      const listed = folderFiles(path)
      more = listed.more
      files = listed.files.map((f) => ({ name: f.name, bytes: () => readFileSync(f.full), size: f.size, origin: f.full }))
      name = basename(path).replace(/\.[^.]+$/, '')
    }
  }
  name = unique(safeName(name.replace(/[^A-Za-z0-9._-]+/g, '-'), 'source'))
  const dir = join(parent, name)
  const facts: RepositoryFacts = { ...emptyFacts(name, dir), origin }
  const skipped: string[] = []
  const copies = new Map<string, { text: string; origin: string }>()
  for (const f of files) {
    if (f.size > MAX_BYTES) { facts.notes.push(`${f.name} is bigger than ${MAX_BYTES / 1e6} MB: left out`); continue }
    let copy
    try {
      copy = await asText(f.name, f.bytes())
    } catch (error) {
      facts.notes.push(`${f.name} does not read: ${(error as Error).message.split('\n')[0]}`)
      continue
    }
    if (!copy) { skipped.push(f.name); continue }
    const key = copy.file.toLowerCase()
    if (copies.has(key)) { facts.notes.push(`${f.name} left out: its copy would be named as another file's (${copy.file})`); continue }
    copies.set(key, { text: copy.text, origin: f.origin })
    facts.documents.push(documentFact(name, posix(copy.file), copy.text, f.origin))
  }
  if (skipped.length) facts.notes.push(`${skipped.length} file${skipped.length === 1 ? '' : 's'} no document Assay reads: ${skipped.slice(0, 10).join(', ')}${skipped.length > 10 ? ', …' : ''}`)
  if (more) facts.notes.push(`${more} more file${more === 1 ? '' : 's'} left out: a source keeps at most ${MAX_FILES}`)
  if (!facts.documents.length) return { problem: `${spec} holds no document Assay reads (Markdown, text, HTML, PDF, YAML, JSON, XML, SQL, …)` }
  ignored(parent)
  const byKey = new Map(facts.documents.map((d) => [d.file.toLowerCase(), d.file]))
  replaceFolder(parent, dir, (fresh) => {
    for (const [key, c] of copies) writeInside(fresh, byKey.get(key)!, c.text)
  })
  return { facts }
}
