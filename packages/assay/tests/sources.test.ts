import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { SOURCES_DIR, UNPACKED_DIR, citationProblem, decodeText, documentFact, extractRepository, guardedLookup, htmlToMarkdown, privateAddress, repositoriesIn, takeSources } from '../src/index'
import { POLYGLOT } from './shop'

const temp = (): string => mkdtempSync(join(tmpdir(), 'assay-sources-'))

/** A one-page PDF whose page shows `text`. */
function pdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

const PAGE = `<!doctype html><html><head><title>Orders guide</title><style>p { color: red }</style><script>var x = 1</script></head>
<body><nav>Home</nav><h1>Orders</h1><p>Orders are paid   before they ship.</p>
<h2>Refunds</h2><ul><li>A refund goes back to the card.</li><li>Within 14 days.</li></ul>
<table><tr><th>Status</th><th>Meaning</th></tr><tr><td>paid</td><td>money taken</td></tr></table>
<pre>GET /orders/{id}
  returns the order</pre><p>Fish &amp; chips</p></body></html>`

let server: Server
let base = ''
/** The test's own server is on a loopback address, which Assay fetches only when told to. */
let own: { allowHosts: string[] }

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/guide/orders.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE); return }
    if (req.url === '/private') { res.writeHead(401, { 'www-authenticate': 'Basic' }); res.end('no'); return }
    if (req.url === '/wiki/space') { res.writeHead(302, { location: '/login?next=/wiki/space' }); res.end(); return }
    if (req.url?.startsWith('/login')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<form><input name="u"><input type="password" name="p"></form>'); return }
    if (req.url === '/escape') { res.writeHead(302, { location: '/x/..%2F..%2F..%2Fpwned.json' }); res.end(); return }
    if (req.url === '/x/..%2F..%2F..%2Fpwned.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"pwned":true}'); return }
    if (req.url === '/metadata') { res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }); res.end(); return }
    if (req.url === '/bad/%zz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Kept.'); return }
    if (req.url === '/reset') { res.writeHead(200, { 'content-type': 'text/html' }); res.write('<p>half'); setTimeout(() => res.destroy(), 10); return }
    if (req.url === '/huge') { res.writeHead(200, { 'content-type': 'text/plain', 'content-length': '60000000' }); res.write('x'); setTimeout(() => res.destroy(), 10); return }
    if (req.url === '/docs/sso/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<h1>Single sign-on</h1><p>How we use SSO.</p>'); return }
    res.writeHead(404); res.end()
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  own = { allowHosts: [new URL(base).host] }
})
afterAll(() => { server.close() })

describe('radical assay: code given by hand', () => {
  it('takes a folder with no repository inside as a folder of code', () => {
    const dir = join(temp(), 'catalog-code')
    cpSync(join(POLYGLOT, 'catalog'), dir, { recursive: true })
    const found = repositoriesIn([dir])
    expect(found.dirs).toEqual([dir])
    const facts = extractRepository(dir)
    expect(facts.repository).toBe('catalog-code')
    expect(facts.units.map((u) => [u.stack, u.kind])).toEqual([['go', 'app']])
  })

  it('unpacks a .zip file of code, and refuses one with an entry outside its folder', () => {
    const root = temp()
    const files: Record<string, Uint8Array> = {}
    for (const f of ['pom.xml', 'src/main/java/shop/OrdersApplication.java', 'src/main/resources/application.yml']) {
      files[`orders/${f}`] = readFileSync(join(POLYGLOT, 'orders', f))
    }
    writeFileSync(join(root, 'orders.zip'), zipSync(files))
    const found = repositoriesIn(['orders.zip'], root, join(root, UNPACKED_DIR))
    expect(found.dirs).toEqual([join(root, UNPACKED_DIR, 'orders')])
    const facts = extractRepository(found.dirs[0])
    expect(facts.units.map((u) => [u.stack, u.kind, u.path])).toEqual([['maven', 'app', 'orders']])

    writeFileSync(join(root, 'evil.zip'), zipSync({ 'readme.md': strToU8('# x'), '../evil.txt': strToU8('x') }))
    expect(() => repositoriesIn(['evil.zip'], root, join(root, UNPACKED_DIR))).toThrow('evil.zip: entry ../evil.txt would land outside the folder it is unpacked into')
    expect(existsSync(join(root, UNPACKED_DIR, 'evil'))).toBe(false)
    expect(existsSync(join(root, UNPACKED_DIR, 'evil.txt'))).toBe(false)
  })
})

describe('radical assay: documents', () => {
  it('turns an HTML page into Markdown: headings, lists, tables and preformatted text; no scripts or styles', () => {
    expect(htmlToMarkdown(PAGE)).toBe([
      'Home', '', '# Orders', '', 'Orders are paid before they ship.', '', '## Refunds', '',
      '- A refund goes back to the card.', '- Within 14 days.', '', 'Status | Meaning', 'paid | money taken', '',
      '```', 'GET /orders/{id}', '  returns the order', '```', '', 'Fish & chips', '',
    ].join('\n'))
    expect(htmlToMarkdown('<html><head><title>Only a title</title></head><body><p>Text</p></body></html>')).toBe('# Only a title\n\nText\n')
  })

  it('keeps a text copy of each document of a folder and a link, as document facts', async () => {
    const root = temp()
    const docs = join(root, 'handover')
    mkdirSync(join(docs, 'pages'), { recursive: true })
    writeFileSync(join(docs, 'overview.md'), '# Billing\n\nIntro.\n\n## Invoices\n\nMonthly.\n')
    writeFileSync(join(docs, 'pages', 'orders.html'), PAGE)
    writeFileSync(join(docs, 'decisions.pdf'), pdf('We keep invoices for ten years'))
    writeFileSync(join(docs, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const { sources, problems } = await takeSources(['handover', `${base}/guide/orders.html`], root, new Set(['billing']), own)
    expect(problems).toEqual([])
    const [folder, link] = sources
    expect(folder.repository).toBe('handover')
    expect(folder.dir).toBe(join(root, SOURCES_DIR, 'handover'))
    expect(folder.documents.map((d) => [d.file, d.title, d.headings.map((h) => h.text)])).toEqual([
      ['decisions.pdf.txt', 'decisions', []],
      ['overview.md', 'Billing', ['Billing', 'Invoices']],
      ['pages/orders.html.md', 'Orders', ['Orders', 'Refunds']],
    ])
    expect(readFileSync(join(folder.dir, 'decisions.pdf.txt'), 'utf8')).toContain('We keep invoices for ten years')
    expect(folder.documents[1]).toMatchObject({ id: 'handover:doc:overview.md', origin: join(realpathSync(docs), 'overview.md'), evidence: { file: 'overview.md', line: 1 } })
    expect(folder.notes).toEqual(['1 file no document Assay reads: logo.png'])
    expect(link.repository).toBe('127.0.0.1-guide-orders')
    expect(link.documents).toMatchObject([{ file: 'orders.html.md', title: 'Orders', origin: `${base}/guide/orders.html` }])
    expect(readFileSync(join(root, SOURCES_DIR, '.gitignore'), 'utf8')).toContain('*')
  })

  it('names a source like a repository of the run apart from it', async () => {
    const root = temp()
    mkdirSync(join(root, 'billing'))
    writeFileSync(join(root, 'billing', 'notes.txt'), 'Notes')
    const { sources } = await takeSources(['billing'], root, new Set(['billing']))
    expect(sources[0].repository).toBe('billing-2')
  })

  it('refuses a link behind a login, keeping nothing of it', async () => {
    const root = temp()
    const { sources, problems } = await takeSources([`${base}/private`, `${base}/wiki/space`], root, new Set(), own)
    expect(sources).toEqual([])
    expect(problems).toEqual([
      `${base}/private asks for a login: it answers 401. Export its pages (PDF, HTML or Markdown) into a folder or a .zip file and give that instead: Assay holds no credentials.`,
      `${base}/wiki/space asks for a login: it leads to a sign-in page (${base}/login?next=/wiki/space). Export its pages (PDF, HTML or Markdown) into a folder or a .zip file and give that instead: Assay holds no credentials.`,
    ])
    expect(existsSync(join(root, SOURCES_DIR, '127.0.0.1-private'))).toBe(false)
  })

  it('lists a repository\'s README, docs and ADR records where they are', () => {
    const dir = join(temp(), 'billing')
    mkdirSync(join(dir, 'docs', 'adr'), { recursive: true })
    mkdirSync(join(dir, 'tests', 'fixtures', 'docs'), { recursive: true })
    writeFileSync(join(dir, 'README.md'), '# Billing\n\nSends invoices.\n\n## Running\n')
    writeFileSync(join(dir, 'docs', 'architecture.md'), 'Intro\n\n# Architecture\n\n## Data\n')
    writeFileSync(join(dir, 'docs', 'adr', '0001-use-postgres.md'), '# 1. Use PostgreSQL\n\n## Status\n\nAccepted\n')
    writeFileSync(join(dir, 'tests', 'fixtures', 'docs', 'sample.md'), '# Not a document of the repository\n')
    writeFileSync(join(dir, 'docs', 'diagram.png'), 'png')
    const facts = extractRepository(dir)
    expect(facts.documents).toEqual([
      { id: 'billing:doc:README.md', file: 'README.md', title: 'Billing', headings: [{ level: 1, text: 'Billing', line: 1 }, { level: 2, text: 'Running', line: 5 }], evidence: { file: 'README.md', line: 1 } },
      { id: 'billing:doc:docs/adr/0001-use-postgres.md', file: 'docs/adr/0001-use-postgres.md', title: '1. Use PostgreSQL', headings: [{ level: 1, text: '1. Use PostgreSQL', line: 1 }, { level: 2, text: 'Status', line: 3 }], evidence: { file: 'docs/adr/0001-use-postgres.md', line: 1 } },
      { id: 'billing:doc:docs/architecture.md', file: 'docs/architecture.md', title: 'Architecture', headings: [{ level: 1, text: 'Architecture', line: 3 }, { level: 2, text: 'Data', line: 5 }], evidence: { file: 'docs/architecture.md', line: 3 } },
    ])
    expect(existsSync(join(dir, SOURCES_DIR))).toBe(false)
  })

  it('refuses a private address, and one a redirect leads to', async () => {
    const root = temp()
    const { sources, problems } = await takeSources([`${base}/guide/orders.html`, `${base}/metadata`, 'http://localhost/x'], root, new Set(), { allowHosts: [] })
    expect(sources).toEqual([])
    expect(problems[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/guide\/orders\.html is not fetched: 127\.0\.0\.1:\d+ is a loopback address \(127\.0\.0\.1\)\. Assay fetches only public links/)
    expect(problems[2]).toMatch(/^http:\/\/localhost\/x is not fetched: localhost is a loopback address/)
    const redirected = await takeSources([`${base}/metadata`], root, new Set(), own)
    expect(redirected.problems).toEqual([`${base}/metadata is not fetched: 169.254.169.254 is a link-local address (169.254.169.254). Assay fetches only public links (RADICAL_ASSAY_PRIVATE_LINKS=1 allows others).`])
    const mapped = await takeSources([`http://[::ffff:127.0.0.1]:${new URL(base).port}/guide/orders.html`], root, new Set(), own)
    expect(mapped.problems[0]).toMatch(/is not fetched: \[::ffff:7f00:1\]:\d+ is a loopback address \(::ffff:7f00:1\)/)
    expect([privateAddress('::ffff:7f00:1'), privateAddress('::ffff:169.254.169.254'), privateAddress('64:ff9b::a9fe:a9fe'), privateAddress('::'), privateAddress('198.18.0.1'), privateAddress('224.0.0.1'), privateAddress('ff02::1')])
      .toEqual(['a loopback address', 'a link-local address', 'a link-local address', 'a loopback address', 'a private network address', 'a multicast or reserved address', 'a multicast or reserved address'])
    // At connection time too: a name that resolves to a private address is refused however it was checked before.
    const refusedAtConnect = await new Promise<{ code?: string }>((done) => guardedLookup('localhost', {}, (error) => done(error as { code?: string })))
    expect(refusedAtConnect.code).toBe('EASSAYPRIVATE')
    expect([privateAddress('10.1.2.3'), privateAddress('172.20.0.1'), privateAddress('192.168.1.1'), privateAddress('fd00::1'), privateAddress('fe80::1'), privateAddress('::1'), privateAddress('8.8.8.8'), privateAddress('2606:4700::1111')])
      .toEqual(['a private network address', 'a private network address', 'a private network address', 'a private network address', 'a link-local address', 'a loopback address', null, null])
  })

  it('keeps every copy inside its own folder, and empties no other', async () => {
    const root = temp()
    mkdirSync(join(root, SOURCES_DIR, 'kept'), { recursive: true })
    writeFileSync(join(root, SOURCES_DIR, 'kept', 'a.md'), '# Kept')
    writeFileSync(join(root, '.radical/assay/run.json'), '{}')
    const link = await takeSources([`${base}/escape`], root, new Set(['kept']), own)
    expect(link.problems).toEqual([])
    expect(link.sources[0].documents.map((d) => d.file)).toEqual(['..-..-..-pwned.json'])
    expect(existsSync(join(root, '..', 'pwned.json'))).toBe(false)
    expect(existsSync(join(link.sources[0].dir, '..-..-..-pwned.json'))).toBe(true)

    mkdirSync(join(root, '..notes'))
    writeFileSync(join(root, '..notes', 'a.md'), '# Notes')
    const dotted = await takeSources(['..notes'], root, new Set(['kept']))
    expect(dotted.sources.map((x) => x.repository)).toEqual(['source'])
    expect(existsSync(join(root, SOURCES_DIR, 'kept', 'a.md'))).toBe(true)

    writeFileSync(join(root, '...zip'), zipSync({ 'go.mod': strToU8('module x\n'), 'main.go': strToU8('package main\nfunc main() {}\n') }))
    const found = repositoriesIn(['...zip'], root, join(root, UNPACKED_DIR))
    expect(found.dirs).toEqual([join(root, UNPACKED_DIR, 'code')])
    expect(readFileSync(join(root, '.radical/assay/run.json'), 'utf8')).toBe('{}')
    expect(existsSync(join(root, SOURCES_DIR, 'kept', 'a.md'))).toBe(true)
  })

  it('replaces a source only when its new copy is taken', async () => {
    const root = temp()
    mkdirSync(join(root, 'notes'))
    writeFileSync(join(root, 'notes', 'a.md'), '# A')
    const first = await takeSources(['notes'], root, new Set())
    rmSync(join(root, 'notes', 'a.md'))
    writeFileSync(join(root, 'notes', 'logo.png'), 'png')
    const again = await takeSources(['notes'], root, new Set())
    expect(again.problems).toEqual(['notes holds no document Assay reads (Markdown, text, HTML, PDF, YAML, JSON, XML, SQL, …)'])
    expect(readFileSync(join(first.sources[0].dir, 'a.md'), 'utf8')).toBe('# A')
    expect(readdirSync(join(root, SOURCES_DIR)).sort()).toEqual(['.gitignore', 'notes'])
  })

  it('takes each source apart: a link that breaks off, or is too big, does not stop the others', async () => {
    const root = temp()
    const { sources, problems } = await takeSources([`${base}/reset`, `${base}/huge`, `${base}/bad/%zz`, `${base}/docs/sso/`], root, new Set(), own)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(new RegExp(`^${base.replace(/\./g, '\\.')}/reset is not taken: `))
    expect(problems[1]).toBe(`${base}/huge is bigger than 50 MB`)
    expect(sources.map((x) => x.documents.map((d) => [d.file, d.title]))).toEqual([[['%zz.txt', '%zz']], [['index.html.md', 'Single sign-on']]])
  })

  it('takes a .zip file of documents, leaving out what no document is', async () => {
    const root = temp()
    writeFileSync(join(root, 'export.zip'), zipSync({ 'space/home.html': strToU8(PAGE), 'space/attachments/a.png': new Uint8Array([1, 2]), '__MACOSX/space/._home.html': strToU8('x') }))
    const { sources } = await takeSources(['export.zip'], root, new Set())
    expect(sources[0].documents).toMatchObject([{ id: 'export:doc:space/home.html.md', title: 'Orders', origin: 'export.zip/space/home.html' }])
    expect(sources[0].notes).toEqual(['1 file no document Assay reads: space/attachments/a.png'])
  })

  it('reads Markdown headings around code blocks that name their language, and no horizontal rule as a block', () => {
    const md = ['# One', '', '```ts', 'const x = 1', '```', '', '# Two', '', '```bash', '# a comment, not a heading', '```', '', '----', '', '## Three', '~~~', '# inside', '~~~', '# Four'].join('\n')
    expect(documentFact('r', 'a.md', md).headings.map((h) => h.text)).toEqual(['One', 'Two', 'Three', 'Four'])
    expect(documentFact('r', 'a.md', ['# One', '````md', '```', '# inside', '```', '````', '# Two'].join('\n')).headings.map((h) => h.text)).toEqual(['One', 'Two'])
  })

  it('reads headings only where the format has them', () => {
    expect(documentFact('r', 'config.yaml', '# Generated by a tool\nkey: 1\n')).toMatchObject({ title: 'config', headings: [] })
    expect(documentFact('r', 'guide.adoc', '= Guide\n\n== Install\n\n----\n= not a heading\n----\n').headings.map((h) => h.text)).toEqual(['Guide', 'Install'])
    expect(documentFact('r', 'README', '# Billing\n').title).toBe('Billing')
  })

  it('decodes UTF-16 and Windows-1252 text', () => {
    expect(decodeText(Buffer.from('\uFEFFZażółć', 'utf16le'))).toBe('Zażółć')
    expect(decodeText(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('Ab', 'utf16le').swap16()]))).toBe('Ab')
    expect(decodeText(Buffer.from([0x93, 0x51, 0x94, 0x20, 0x80, 0x35, 0x20, 0x92]))).toBe('\u201CQ\u201D \u20AC5 \u2019')
  })

  it('lets a file named with leading dots be quoted', () => {
    const dir = join(temp(), 'notes')
    mkdirSync(dir)
    writeFileSync(join(dir, '..draft.md'), 'The draft says hello there.\n')
    const repo = { ...extractRepository(dir), repository: 'notes' }
    expect(citationProblem({ repository: 'notes', file: '..draft.md', lines: [1, 1], text: 'The draft says hello there.' }, [repo])).toBeNull()
    expect(citationProblem({ repository: 'notes', file: '../notes/..draft.md', lines: [1, 1], text: 'The draft says hello there.' }, [repo])).toBeNull()
    expect(citationProblem({ repository: 'notes', file: '../x.md', lines: [1, 1], text: 'The draft says hello there.' }, [repo])).toMatch(/which the repository does not have$/)
    writeFileSync(join(dir, 'huge.txt'), Buffer.alloc(20_000_001, 'a'))
    expect(citationProblem({ repository: 'notes', file: 'huge.txt', lines: [1, 1], text: 'aaaaaaaaaaaa' }, [repo])).toBe('cites notes/huge.txt, which is bigger than 20 MB: quote a smaller file')
  })
})

describe('radical assay: code given by hand, kept from harm', () => {
  it('leaves out a .git folder of a .zip file, so its configuration never runs', () => {
    const root = temp()
    const marker = join(root, 'PWNED')
    writeFileSync(join(root, 'evil.zip'), zipSync({
      'app/.git/HEAD': strToU8('ref: refs/heads/main\n'),
      'app/.git/config': strToU8(`[core]\n\trepositoryformatversion = 0\n\tfsmonitor = touch ${marker}\n`),
      'app/go.mod': strToU8('module app\n'),
      'app/main.go': strToU8('package main\nfunc main() {}\n'),
    }))
    const found = repositoriesIn(['evil.zip'], root, join(root, UNPACKED_DIR))
    expect(found.dirs).toEqual([join(root, UNPACKED_DIR, 'evil', 'app')])
    const facts = extractRepository(found.dirs[0])
    expect(existsSync(join(found.dirs[0], '.git'))).toBe(false)
    expect(facts.units.map((u) => u.path)).toEqual(['.'])
    expect(facts.commit).toBeUndefined()
    expect(existsSync(marker)).toBe(false)

    // A .GIT folder is a .git folder where names are case-blind (macOS, Windows).
    writeFileSync(join(root, 'upper.zip'), zipSync({ 'app/.GIT/config': strToU8(`[core]\n\tfsmonitor = touch ${marker}\n`), 'app/go.mod': strToU8('module app\n') }))
    const upper = repositoriesIn(['upper.zip'], root, join(root, UNPACKED_DIR))
    expect(readdirSync(upper.dirs[0])).toEqual(['go.mod'])
    extractRepository(upper.dirs[0])
    expect(existsSync(marker)).toBe(false)
  })

  it('reads each repository a .zip file holds as a folder of code of its own', () => {
    const root = temp()
    writeFileSync(join(root, 'estate.zip'), zipSync({
      'orders/.git/HEAD': strToU8('ref: refs/heads/main\n'), 'orders/go.mod': strToU8('module orders\n'), 'orders/main.go': strToU8('package main\nfunc main() {}\n'),
      'billing/.git/HEAD': strToU8('ref: refs/heads/main\n'), 'billing/go.mod': strToU8('module billing\n'), 'billing/main.go': strToU8('package main\nfunc main() {}\n'),
      'billing/vendor/lib/.git/HEAD': strToU8('x'),
    }))
    const found = repositoriesIn(['estate.zip'], root, join(root, UNPACKED_DIR))
    expect(found.dirs).toEqual(['billing', 'orders'].map((r) => join(root, UNPACKED_DIR, 'estate', r)))
    expect(found.notes).toEqual(['estate.zip holds 2 repositories (billing, orders): each is read as a folder of code, without its .git folder'])
    expect(found.dirs.map((d) => extractRepository(d).units.map((u) => u.name))).toEqual([['billing'], ['orders']])
  })

  it('unpacks two .zip files of one name apart', () => {
    const root = temp()
    for (const at of ['a', 'b']) {
      mkdirSync(join(root, at))
      writeFileSync(join(root, at, 'code.zip'), zipSync({ [`${at}.go`]: strToU8('package main\n'), 'go.mod': strToU8(`module ${at}\n`) }))
    }
    const found = repositoriesIn(['a/code.zip', 'b/code.zip'], root, join(root, UNPACKED_DIR))
    expect(found.dirs).toEqual([join(root, UNPACKED_DIR, 'code'), join(root, UNPACKED_DIR, 'code-2')])
  })

  it('finds repositories deeper in a directory of folders, and names those a folder of code leaves out', () => {
    const dev = join(temp(), 'dev')
    for (const r of ['org/billing', 'org/orders', 'personal/notes']) { mkdirSync(join(dev, r), { recursive: true }); execFileSync('git', ['init', '-q'], { cwd: join(dev, r) }) }
    expect(repositoriesIn([dev]).dirs).toEqual(['org/billing', 'org/orders', 'personal/notes'].map((r) => join(dev, r)))

    const code = join(temp(), 'code')
    mkdirSync(join(code, 'libs', 'vendor-lib'), { recursive: true })
    mkdirSync(join(code, 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(code, 'go.mod'), 'module code\n')
    writeFileSync(join(code, 'node_modules', 'x', 'package.json'), '{"name":"x"}')
    execFileSync('git', ['init', '-q'], { cwd: join(code, 'libs', 'vendor-lib') })
    expect(repositoriesIn([code]).dirs).toEqual([code])
    const facts = extractRepository(code)
    expect(facts.notes).toContain('1 repository inside this folder of code left out (libs/vendor-lib): give them on their own, or the folder that holds them directly')
    expect(facts.units.map((u) => u.path)).toEqual(['.'])

    const workspace = join(temp(), 'workspace')
    mkdirSync(join(workspace, 'orders'), { recursive: true })
    execFileSync('git', ['init', '-q'], { cwd: join(workspace, 'orders') })
    writeFileSync(join(workspace, 'docker-compose.yml'), 'services: {}\n')
    expect(repositoriesIn([workspace])).toEqual({ dirs: [join(workspace, 'orders')], empty: [], notes: [`${workspace} holds files of its own besides the repositories inside it: only the repositories are read (give the files' folder on its own to read them)`] })
  })
})

