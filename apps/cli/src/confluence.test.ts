import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node, DiagramData, DiagramView } from '@radical/common/c4'
import { main } from './cli'
import { anchorOf, exportWiki } from './wikiExport'
import { confluenceBase, publishWiki } from './confluence'
import { publishTree, treePlan } from './confluenceTree'

const dirs: string[] = []
afterEach(async () => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs()
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
const node = (id: string, type: string, label: string, extra = {}): C4Node => ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as C4Node
const view: DiagramView = {
  id: 'wiki-1', name: 'Tes confluence', kind: 'wiki', nodeIds: [], positions: {}, wikiFocusId: 'req', wikiPageMode: 'single', wikiDepth: 1,
  pipeline: { levels: [
    { ways: [{ types: ['requirement'] }] },
    { ways: [{ types: ['scenario'], via: { relationType: 'verifies', direction: 'in' } }] },
  ] },
}
function model(): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(), views: [view],
    nodes: [
      node('req', 'requirement', 'Pay & confirm', { ears_type: 'event-driven', trigger: 'the user pays', action: 'take the payment', rationale: '**Fast** and safe.\n\n- Check balance\n- Charge card' }),
      node('req2', 'requirement', 'Receipt', { action: 'issue a receipt' }),
      node('scenario', 'scenario', 'Successful checkout', { given: 'a valid card', when: 'the customer pays', then: 'the order is paid', tests: 'src/checkout.test.ts › pays' }),
      node('outside', 'need', 'OUTSIDE SECRET', { description: 'Not part of the view.' }),
    ],
    relations: [
      { id: 'v1', sourceId: 'scenario', targetId: 'req', relationType: 'verifies' },
      { id: 'v2', sourceId: 'scenario', targetId: 'req2', relationType: 'verifies' },
      { id: 'd', sourceId: 'req', targetId: 'outside', relationType: 'derives' },
    ],
  }
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
const destination = { url: 'https://company.atlassian.net', email: 'publisher@example.com', token: 'secret-token', spaceId: '123', parentId: '99' }

describe('Confluence wiki projection', () => {
  it('exports the whole view as linked requirements and scenarios, with readable fields', () => {
    const data = model()
    const before = structuredClone(data)
    const out = exportWiki(data, view, { sourceUrl: 'https://studio.radical.tools/#/view' })
    expect(data).toEqual(before)
    expect(out.elementCount).toBe(3)
    expect(out.markdown).toContain('When the user pays, the system shall take the payment.')
    expect(out.markdown).toContain('### Successful checkout')
    expect(out.markdown).toContain(`**Verified by:** [Successful checkout](#${anchorOf('scenario')})`)
    expect(out.markdown).toContain(`**Verifies:** [Pay & confirm](#${anchorOf('req')})`)
    expect(out.markdown).toContain(`<a id="${anchorOf('scenario')}"></a>`)
    expect(out.storage).toContain('Radical is the source of truth')
    expect(out.storage).toContain('<strong>Fast</strong>')
    expect(out.storage).toContain('<ul><li>Check balance</li><li>Charge card</li></ul>')
    expect(out.storage).toContain('Pay &amp; confirm')
    expect(out.storage).not.toContain('OUTSIDE SECRET')
    expect(out.storage).toContain(`ac:anchor="${anchorOf('req')}"`)
    expect(out.storage.match(new RegExp(`<h3>Successful checkout</h3>`, 'g'))).toHaveLength(2)
    expect(out.storage.match(/a valid card/g)).toHaveLength(1)
    expect(out.html).toContain(`href="#${anchorOf('scenario')}"`)
    expect(out.html).not.toContain('<ac:')
    expect(out.html).not.toContain('<ri:')
  })

  it('respects chain filters, explicit membership and emptied views', () => {
    const data = model()
    const filtered = { ...view, nodeIds: ['req', 'scenario'] }
    expect(exportWiki(data, filtered).elementCount).toBe(2)
    expect(exportWiki(data, filtered).markdown).not.toContain('Receipt')
    expect(exportWiki(data, { ...view, nodeIds: [], empty: true }).elementCount).toBe(0)
    const pipeline = { levels: [{ ways: [{ types: ['requirement'] }], filters: [{ kind: 'text' as const, text: 'Receipt' }] }] }
    expect(exportWiki(data, { ...view, pipeline }).elementCount).toBe(1)
  })

  it('uses containment when no chain is defined, including navigation ancestors', () => {
    const data = model()
    data.nodes.push(node('sys', 'system', 'Checkout'))
    data.nodes[0].parentId = 'sys'
    const out = exportWiki(data, { ...view, pipeline: undefined, nodeIds: ['req'] })
    expect(out.elementCount).toBe(2)
    expect(out.markdown).toContain('## Checkout')
    expect(out.markdown).toContain('### Pay & confirm')
    expect(out.markdown).not.toContain('Successful checkout')
  })

  it('escapes raw HTML, rejects unsafe URLs and reports unavailable assets', () => {
    const data = model()
    Object.assign(data.nodes[0], { rationale: '<script>evil()</script>\n\n[unsafe](javascript:alert)\n\n[local](./guide.md)\n\n![Local](./diagram.png)\n\n![Remote](https://example.com/diagram.png)\n\n```xml\n<x>&value</x>\n```' })
    const out = exportWiki(data, view)
    expect(out.storage).not.toContain('<script>')
    expect(out.storage).not.toContain('href="javascript:')
    expect(out.storage).toContain('&lt;script&gt;')
    expect(out.storage).toContain('<ri:url ri:value="https://example.com/diagram.png" />')
    expect(out.storage).toContain('&lt;x&gt;&amp;value&lt;/x&gt;')
    expect(out.warnings.join(' ')).toContain('images were not uploaded')
    expect(out.warnings.join(' ')).toContain('unsupported Markdown links')
  })

  it('preserves custom fields, reference links, booleans and numbers', () => {
    const data = model()
    data.metamodel!.id = 'custom-wiki'
    data.metamodel!.nodeTypes.requirement.properties!.push(
      { key: 'owner', label: 'Owner', type: 'ref', refType: 'scenario' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'approved', label: 'Approved', type: 'boolean' },
    )
    Object.assign(data.nodes[0], { owner: 'scenario', score: 0, approved: true })
    const out = exportWiki(data, view)
    expect(out.markdown).toContain(`**Owner**\n\n[Successful checkout](#${anchorOf('scenario')})`)
    expect(out.markdown).toContain('**Score**\n\n0')
    expect(out.markdown).toContain('**Approved**\n\napproved')
  })

  it('reads full-model requirement context while keeping linked pages within the selected view', () => {
    const data = model()
    data.nodes.push(node('engine', 'component', 'Checkout engine'))
    data.relations.push({ id: 'satisfies', sourceId: 'engine', targetId: 'req', relationType: 'satisfies' })
    const out = exportWiki(data, view)
    expect(out.markdown).toContain('When the user pays, Checkout engine shall take the payment.')
    expect(out.pages.map((p) => p.nodeId)).not.toContain('engine')
    expect(out.markdown).not.toContain('**Satisfied by:**')
  })

  it('keeps requirement text literal, as Studio does, while rendering Markdown prose fields', () => {
    const data = model()
    Object.assign(data.nodes[0], { action: 'accept *cards* and [refunds](https://example.com)' })
    const out = exportWiki(data, view)
    expect(out.storage.replace(/<[^>]+>/g, '')).toContain('accept *cards* and [refunds](https://example.com).')
    expect(out.storage).not.toContain('>refunds</a>')
    expect(out.storage).not.toContain('<em>cards</em>')
    expect(out.storage).toContain('<strong>Fast</strong>')
  })

  it('uses Studio field visibility and preset loading rules rather than exporting raw node properties', () => {
    const data = model()
    Object.assign(data.nodes[0], { description: 'Undeclared description', internal_notes: 'Hidden field', notes: 'Visible field' })
    data.metamodel!.id = 'custom-wiki'
    data.metamodel!.nodeTypes.requirement.properties!.push(
      { key: 'internal_notes', label: 'Internal notes', type: 'textarea', visibleWhen: { key: 'ears_type', values: ['ubiquitous'] } },
      { key: 'notes', label: 'Notes (optional)', type: 'text' },
    )
    const out = exportWiki(data, view)
    expect(out.markdown).toContain('**Notes**\n\nVisible field')
    expect(out.markdown).not.toContain('Hidden field')
    expect(out.markdown).not.toContain('Undeclared description')
    // Built-in IDs load the current preset in both Studio and the CLI.
    data.metamodel!.id = builtInGovernanceMetamodel().id
    expect(exportWiki(data, view).markdown).not.toContain('Visible field')
  })
})

describe('Confluence Cloud publisher', () => {
  it('creates a page with storage content under the requested parent', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ results: [] })).mockResolvedValueOnce(json({ id: '456' }))
    const out = exportWiki(model(), view)
    expect(await publishWiki(out, destination, request)).toEqual({ id: '456', url: 'https://company.atlassian.net/wiki/pages/viewpage.action?pageId=456', action: 'created' })
    expect(request.mock.calls[0][0]).toContain('space-id=123')
    const call = request.mock.calls[1]
    expect(call[0]).toBe('https://company.atlassian.net/wiki/api/v2/pages')
    expect(call[1]?.redirect).toBe('error')
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({ spaceId: '123', parentId: '99', title: 'Tes confluence', status: 'current', body: { representation: 'storage', value: out.storage } })
  })

  it('finds the previous export and updates its current version, without creating duplicates', async () => {
    const out = exportWiki(model(), view)
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ results: [{ id: '456' }] }))
      .mockResolvedValueOnce(json({ id: '456', status: 'current', spaceId: '123', version: { number: 7 }, body: { storage: { value: out.storage } } }))
      .mockResolvedValueOnce(json({ id: '456' }))
    expect((await publishWiki(out, destination, request)).action).toBe('updated')
    expect(request.mock.calls[2][1]?.method).toBe('PUT')
    expect(JSON.parse(request.mock.calls[2][1]!.body as string).version.number).toBe(8)
    expect(JSON.parse(request.mock.calls[2][1]!.body as string).parentId).toBe('99')
  })

  it('refuses unrelated pages, a different wiki marker and another space', async () => {
    const out = exportWiki(model(), view)
    for (const [body, spaceId] of [['<p>Handwritten</p>', '123'], [exportWiki(model(), { ...view, id: 'another' }).storage, '123'], [out.storage, '999']]) {
      const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ id: '456', status: 'current', spaceId, version: { number: 1 }, body: { storage: { value: body } } }))
      await expect(publishWiki(out, { ...destination, pageId: '456' }, request)).rejects.toThrow(/not a managed export|different space/)
      expect(request).toHaveBeenCalledTimes(1)
    }
  })

  it('reports version conflicts without retrying or exposing server output', async () => {
    const out = exportWiki(model(), view)
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ id: '456', status: 'current', spaceId: '123', version: { number: 2 }, body: { storage: { value: out.storage } } }))
      .mockResolvedValueOnce(json({ message: 'secret-token' }, 409))
    await expect(publishWiki(out, { ...destination, pageId: '456' }, request)).rejects.toThrow('HTTP 409')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('reports authentication and network errors without reflecting secrets', async () => {
    const out = exportWiki(model(), view)
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ secret: 'secret-token' }, 401))
    await expect(publishWiki(out, destination, request)).rejects.toThrow('HTTP 401')
    request.mockRejectedValue(new Error('secret-token'))
    await expect(publishWiki(out, destination, request)).rejects.toThrow('Cannot reach Confluence')
  })

  it('retries an explicit rate-limit rejection and honors Retry-After', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(json({ results: [] }))
      .mockResolvedValueOnce(json({ id: '456' }))
    expect((await publishWiki(exportWiki(model(), view), destination, request)).action).toBe('created')
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls[0][0]).toBe(request.mock.calls[1][0])
  })

  it('normalizes site URLs and refuses credentials or unsafe destinations', () => {
    expect(confluenceBase('https://company.atlassian.net/wiki/')).toBe('https://company.atlassian.net/wiki')
    for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/?token=x', 'https://example.com/wiki/api/v2']) expect(() => confluenceBase(url)).toThrow()
  })
})

/** In-memory API with real parent IDs, versions and independently versioned properties. */
function confluenceServer() {
  const pages = new Map<string, Record<string, any>>()
  const properties = new Map<string, Record<string, any>>()
  let counter = 1000
  let failTitle: string | undefined
  const request = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/wiki/api/v2', '')
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    if (path === '/pages' && init?.method === 'POST') {
      if (body.title === failTitle) return json({}, 503)
      const id = String(++counter)
      const page = { ...body, id, version: { number: 1 }, body: { storage: { value: body.body.value } } }
      pages.set(id, page); return json(page)
    }
    if (path === '/pages') return json({ results: [...pages.values()].filter((p) => p.title === url.searchParams.get('title') && p.spaceId === url.searchParams.get('space-id')) })
    const match = path.match(/^\/pages\/(\d+)(?:\/properties(?:\/(\d+))?)?$/)
    if (!match || !pages.has(match[1])) return json({}, 404)
    const [, id, propertyId] = match
    if (path.includes('/properties')) {
      if (init?.method === 'POST' || init?.method === 'PUT') {
        const saved = { ...body, id: propertyId ?? String(++counter), version: body.version ?? { number: 1 }, pageId: id }
        properties.set(saved.id, saved); return json(saved)
      }
      return json({ results: [...properties.values()].filter((p) => p.pageId === id) })
    }
    if (init?.method === 'PUT') {
      const previous = pages.get(id)!
      if (previous.version.number + 1 !== body.version.number) return json({}, 409)
      const saved = { ...previous, ...body, body: { storage: { value: body.body.value } } }
      pages.set(id, saved); return json(saved)
    }
    return json(pages.get(id))
  })
  return { request, pages, properties, fail: (title?: string) => { failTitle = title } }
}

describe('Confluence page tree', () => {
  it('plans one canonical page per element, native crosslinks and deterministic duplicate titles', () => {
    const data = model(); data.nodes[1].label = data.nodes[0].label
    const document = exportWiki(data, view)
    const plan = treePlan(document)
    expect(plan.pages).toHaveLength(3)
    expect(new Set(plan.pages.map((p) => p.title)).size).toBe(3)
    const scenario = plan.pages.find((p) => p.nodeId === 'scenario')!
    expect(scenario.parentNodeId).toBe('req')
    expect(plan.pages.find((p) => p.nodeId === 'req2')!.storage).toContain('Successful checkout')
    expect(scenario.storage).toContain('<ri:page ri:content-title=')
    expect(scenario.storage).not.toContain('ac:anchor=')
  })

  it('publishes the hierarchy, preserves IDs across renames, skips unchanged pages and moves the root', async () => {
    const server = confluenceServer()
    const data = model(), document = exportWiki(data, view)
    const first = await publishTree(document, destination, server.request)
    expect(first.created).toBe(3); expect(server.pages.size).toBe(4)
    const req = [...server.pages.values()].find((p) => p.title.endsWith('Pay & confirm'))!
    const scenario = [...server.pages.values()].find((p) => p.title.endsWith('Successful checkout'))!
    expect(req.parentId).toBe(first.id); expect(scenario.parentId).toBe(req.id)
    // Confluence can normalize storage markup without making a new version.
    scenario.body.storage.value += '\n'
    const second = await publishTree(document, destination, server.request)
    expect(second.created).toBe(0); expect(second.unchanged).toBe(3)
    data.nodes[0].label = 'Payment approved'
    const renamed = exportWiki(data, view)
    const third = await publishTree(renamed, { ...destination, pageId: first.id, parentId: '200' }, server.request)
    expect(third.created).toBe(0); expect(server.pages.size).toBe(4)
    expect(server.pages.get(req.id)!.title).toContain('Payment approved')
    expect(server.pages.get(first.id)!.parentId).toBe('200')
    expect(server.pages.get(scenario.id)!.parentId).toBe(req.id)
  })

  it('recovers partial creates without duplicating pages and keeps removed elements', async () => {
    const server = confluenceServer(), document = exportWiki(model(), view)
    server.fail('Tes confluence · Successful checkout')
    await expect(publishTree(document, destination, server.request)).rejects.toThrow('rerun with --page-id')
    expect(server.pages.size).toBe(3)
    // Simulate losing the checkpoint after successful creates.
    server.properties.clear(); server.fail()
    const resumed = await publishTree(document, destination, server.request)
    expect(resumed.created).toBe(1); expect(server.pages.size).toBe(4)
    const messages: string[] = []
    const filtered = exportWiki(model(), { ...view, nodeIds: ['req'] })
    await publishTree(filtered, destination, server.request, (m) => messages.push(m))
    expect(server.pages.size).toBe(4)
    expect(messages.join(' ')).toContain('previously exported pages are no longer in this view')
  })

  it('replaces remote body edits but refuses a page whose ownership marker was removed', async () => {
    const server = confluenceServer(), document = exportWiki(model(), view)
    await publishTree(document, destination, server.request)
    const scenario = [...server.pages.values()].find((p) => p.title.endsWith('Successful checkout'))!
    scenario.body.storage.value += '<p>Remote edit</p>'; scenario.version.number++
    const changed = await publishTree(document, destination, server.request)
    expect(changed.updated).toBe(1)
    expect(server.pages.get(scenario.id)!.body.storage.value).not.toContain('Remote edit')
    server.pages.get(scenario.id)!.body.storage.value = '<p>Unmanaged</p>'
    await expect(publishTree(document, destination, server.request)).rejects.toThrow('not a managed export')
    expect(server.pages.get(scenario.id)!.body.storage.value).toBe('<p>Unmanaged</p>')
  })
})

async function workspace(data = model()) {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-confluence-'))
  dirs.push(cwd)
  const files = serializeToMdFolder(data, 'Wiki export')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
  return { cwd, files }
}
async function run(cwd: string, ...args: string[]) {
  let out = '', err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical export confluence', () => {
  it('publishes a page tree by default', async () => {
    const { cwd } = await workspace()
    vi.stubEnv('CONFLUENCE_URL', destination.url); vi.stubEnv('CONFLUENCE_EMAIL', destination.email); vi.stubEnv('CONFLUENCE_API_TOKEN', destination.token)
    const server = confluenceServer(); vi.stubGlobal('fetch', server.request)
    const result = await run(cwd, 'export', 'confluence', 'model', '--view', view.id, '--publish', '--space-id', '123')
    expect(result.code).toBe(0); expect(server.pages.size).toBe(4)
    expect(result.err).toContain('3/3 element pages')
  })
  it('lists wiki views and exports by ID or name without changing the model', async () => {
    const { cwd, files } = await workspace()
    const request = vi.fn(); vi.stubGlobal('fetch', request)
    expect((await run(cwd, 'export', 'confluence', 'model', '--list-views')).out).toContain('wiki-1\tTes confluence')
    const byName = await run(cwd, 'export', 'confluence', 'model', '--view', view.name, '--format', 'markdown')
    const byId = await run(cwd, 'export', 'confluence', 'model', '--view', view.id, '--format', 'markdown')
    expect(byName.code).toBe(0); expect(byName.out).toBe(byId.out)
    expect(byName.out).toContain('Successful checkout')
    expect(request).not.toHaveBeenCalled()
    for (const [path, content] of Object.entries(files)) expect(await readFile(join(cwd, 'model', path), 'utf8')).toBe(content)
  })

  it('writes a browser preview outside the source and refuses to overwrite files', async () => {
    const { cwd } = await workspace()
    const args = ['export', 'confluence', 'model', '--view', view.id, '--format', 'html', '--output', 'preview.html']
    expect((await run(cwd, ...args)).code).toBe(0)
    expect(await readFile(join(cwd, 'preview.html'), 'utf8')).toContain('<!doctype html>')
    expect((await run(cwd, ...args)).code).toBe(2)
    expect((await run(cwd, ...args.slice(0, -1), 'model/new.md')).err).toContain('outside the source model')
  })

  it('publishes only explicitly, using environment credentials', async () => {
    const { cwd } = await workspace()
    vi.stubEnv('CONFLUENCE_URL', destination.url); vi.stubEnv('CONFLUENCE_EMAIL', destination.email); vi.stubEnv('CONFLUENCE_API_TOKEN', destination.token)
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ results: [] })).mockResolvedValueOnce(json({ id: '456' }))
    vi.stubGlobal('fetch', request)
    const result = await run(cwd, 'export', 'confluence', 'model', '--view', view.name, '--publish', '--space-id', '123', '--structure', 'document')
    expect(result.code).toBe(0)
    expect(result.out).toContain('Created Confluence page 456')
    expect(result.out + result.err).not.toContain('secret-token')
  })

  it('reads the token from a named environment variable', async () => {
    const { cwd } = await workspace()
    vi.stubEnv('CONFLUENCE_URL', destination.url); vi.stubEnv('CONFLUENCE_EMAIL', destination.email)
    vi.stubEnv('CONFLUENCE_API_TOKEN', ''); vi.stubEnv('TEST_WORKSPACE_ATTLASIAN_KEY', destination.token)
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ results: [] })).mockResolvedValueOnce(json({ id: '456' }))
    vi.stubGlobal('fetch', request)
    const result = await run(cwd, 'export', 'confluence', 'model', '--view', view.id, '--publish', '--space-id', '123', '--token-env', 'TEST_WORKSPACE_ATTLASIAN_KEY', '--structure', 'document')
    expect(result.code).toBe(0)
    expect(request.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from(`${destination.email}:${destination.token}`).toString('base64')}` })
  })

  it('rejects missing, ambiguous or non-wiki selections and invalid options', async () => {
    const { cwd } = await workspace({ ...model(), views: [view, { ...view, id: 'wiki-2' }, { ...view, id: 'table', kind: 'table' }] })
    for (const args of [[], ['--view', 'missing'], ['--view', view.name], ['--view', 'table'], ['--view', view.id, '--format', 'pdf'], ['--view', view.id, '--space-id', '123'], ['--view', view.id, '--publish', '--page-id', 'bad'], ['--bogus']]) {
      expect((await run(cwd, 'export', 'confluence', 'model', ...args)).code).toBe(2)
    }
    expect((await run(cwd, 'export', 'confluence', '--help')).code).toBe(0)
    expect((await run(cwd, 'help', 'export')).out).toContain('Usage: radical export confluence')
    expect((await run(cwd, 'export', 'wrong')).code).toBe(2)
  })
})
