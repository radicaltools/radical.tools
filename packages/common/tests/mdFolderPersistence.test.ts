import { describe, it, expect } from 'vitest'
import {
  serializeToMdFolder,
  serializeToMdFolderWithPaths,
  deserializeFromMdFolder,
  MalformedFolderFileError,
  isMdFolder,
  staleMdFolderFiles,
  MD_MANIFEST_FILE,
} from '../src/formats/mdFolder'
import type { DiagramData, C4Node } from '../src/c4'
import { builtInC4Metamodel } from '../src/metamodel'

function node(partial: Partial<C4Node> & Pick<C4Node, 'id' | 'type' | 'label'>): C4Node {
  return {
    collapsed: false,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...partial,
  } as C4Node
}

const sample: DiagramData = {
  nodes: [
    node({ id: 'sys1', type: 'system', label: 'Payment System', description: 'Handles payments', x: 10, y: 20, width: 400, height: 300 }),
    node({ id: 'ctn1', type: 'container', label: 'API', parentId: 'sys1', technology: 'Node.js', description: 'REST API' }),
    node({ id: 'db1', type: 'database', label: 'Ledger DB', parentId: 'ctn1', x: 5, y: 5 }),
    node({ id: 'adr1', type: 'adr', label: 'Use event sourcing', collapsed: true, ...({
      status: 'accepted',
      date: '2026-01-01',
      context: 'We need an audit trail.\nMultiple regulators require it.',
      decision: 'Adopt event sourcing.',
    } as Record<string, unknown>) }),
    node({ id: 'req1', type: 'requirement', label: 'Latency', ...({
      ears_type: 'event-driven',
      trigger: 'a payment is submitted',
      action: 'process it within 200ms',
      priority: 'must',
    } as Record<string, unknown>) }),
  ],
  relations: [
    { id: 'rel1', sourceId: 'ctn1', targetId: 'db1', relationType: 'interacts', label: 'reads/writes' },
    { id: 'rel2', sourceId: 'adr1', targetId: 'ctn1', relationType: 'constrains' },
  ],
  views: [
    { id: 'v1', name: 'Context', kind: 'static', nodeIds: ['sys1'], positions: { sys1: { x: 0, y: 0, width: 400, height: 300 } } },
  ],
  sequences: [{ id: 's1', name: 'Pay flow', relationIds: ['rel1'] }],
  defaultPositions: { sys1: { x: 10, y: 20, width: 400, height: 300 } },
  defaultViewport: { x: 0, y: 0, zoom: 1 },
}

describe('md-folder persistence', () => {
  it('keeps a list property (a multiple reference) as a list of ids', () => {
    const risk = node({ id: 'risk1', type: 'adr', label: 'Vendor lock-in', ...({ owners: ['p1', 'p2'], note: '[not a list]' } as Record<string, unknown>) })
    const files = serializeToMdFolder({ nodes: [risk], relations: [] }, 'Refs')
    const md = Object.entries(files).find(([path]) => path.endsWith('.md') && path !== MD_MANIFEST_FILE)![1]
    expect(md).toContain('owners: ["p1","p2"]')
    const back = deserializeFromMdFolder(files).data.nodes[0] as unknown as Record<string, unknown>
    expect(back.owners).toEqual(['p1', 'p2'])
    expect(back.note).toBe('[not a list]')
  })

  it('produces a manifest and one file per node', () => {
    const files = serializeToMdFolder(sample, 'Demo')
    expect(isMdFolder(files)).toBe(true)
    expect(files[MD_MANIFEST_FILE]).toContain('radicalFormat')
    // Container systems/containers are directories with _index.md; leaves are .md
    const paths = Object.keys(files)
    expect(paths).toContain('nodes/payment-system/_index.md')
    expect(paths).toContain('nodes/payment-system/api/_index.md')
    expect(paths).toContain('nodes/payment-system/api/ledger-db.md')
    expect(paths.some((p) => p.startsWith('nodes/use-event-sourcing'))).toBe(true)
  })

  it('stores a web app as a directory, with or without components, and reads its old flat file', () => {
    const web = node({ id: 'web1', type: 'webapp', label: 'Portal', parentId: 'sys1' })
    const data = { ...sample, nodes: [...sample.nodes, web] }
    const files = serializeToMdFolder(data)
    expect(Object.keys(files)).toContain('nodes/payment-system/portal/_index.md')
    // A folder written before web apps held components keeps a flat file.
    const flat: Record<string, string> = { ...files, 'nodes/payment-system/portal.md': files['nodes/payment-system/portal/_index.md'] }
    delete flat['nodes/payment-system/portal/_index.md']
    const back = deserializeFromMdFolder(flat).data.nodes.find((n) => n.id === 'web1')
    expect(back).toMatchObject({ type: 'webapp', parentId: 'sys1' })
  })

  it('keeps positions out of the markdown and in the layout sidecar', () => {
    const files = serializeToMdFolder(sample)
    const md = files['nodes/payment-system/_index.md']
    expect(md).not.toMatch(/^x:/m)
    expect(md).not.toMatch(/^width:/m)
    const layout = JSON.parse(files['_layout.json'])
    expect(layout.nodes.sys1).toEqual({ x: 10, y: 20, width: 400, height: 300, collapsed: false })
  })

  it('round-trips losslessly', () => {
    const files = serializeToMdFolder(sample, 'Demo')
    const { data: back } = deserializeFromMdFolder(files)

    const byId = (d: DiagramData): Record<string, C4Node> =>
      Object.fromEntries(d.nodes.map((n) => [n.id, n]))
    const orig = byId(sample)
    const rt = byId(back)

    expect(Object.keys(rt).sort()).toEqual(Object.keys(orig).sort())
    for (const id of Object.keys(orig)) {
      expect(rt[id]).toEqual(orig[id])
    }
    expect(back.relations).toEqual(sample.relations)
    expect(back.views).toEqual(sample.views)
    expect(back.sequences).toEqual(sample.sequences)
    expect(back.defaultPositions).toEqual(sample.defaultPositions)
    expect(back.defaultViewport).toEqual(sample.defaultViewport)
  })

  it('writes no empty text, unticked box or empty list, unless the property\'s default would show instead', () => {
    const metamodel = builtInC4Metamodel()
    metamodel.nodeTypes.system.properties = [
      ...(metamodel.nodeTypes.system.properties ?? []),
      { key: 'supported', label: 'Supported', type: 'boolean', default: true },
      { key: 'owner', label: 'Owner', type: 'text', default: 'Platform team' },
    ]
    const shop = node({ id: 'shop', type: 'system', label: 'Shop', description: '', external: false, technology: '', ...({ tags: [], supported: false, owner: '' } as Record<string, unknown>) })
    const files = serializeToMdFolder({ nodes: [shop], relations: [], metamodel }, 'Empty values')
    const md = Object.entries(files).find(([path]) => path.endsWith('.md') && path !== MD_MANIFEST_FILE)![1]
    expect(md).not.toMatch(/external|technology|tags|description/)
    expect(md).toContain('supported: false')
    expect(md).toContain('owner: ""')
    const back = deserializeFromMdFolder(files).data.nodes[0] as unknown as Record<string, unknown>
    expect(back).toMatchObject({ supported: false, owner: '' })
    expect('external' in back).toBe(false)
  })

  it('preserves custom metamodel property types and multiline prose', () => {
    const files = serializeToMdFolder(sample)
    const { data: back } = deserializeFromMdFolder(files)
    const adr = back.nodes.find((n) => n.id === 'adr1') as unknown as Record<string, unknown>
    expect(adr.status).toBe('accepted')
    expect(adr.context).toBe('We need an audit trail.\nMultiple regulators require it.')
    expect(adr.collapsed).toBe(true)
    const req = back.nodes.find((n) => n.id === 'req1') as unknown as Record<string, unknown>
    expect(req.ears_type).toBe('event-driven')
    expect(req.priority).toBe('must')
  })

  it('stores a need\'s free text as the Markdown body of its file', () => {
    const text = '# Checkout brief\n\nCustomers want to pay with a saved card.\n\n- Must work on mobile\n- GDPR applies'
    const data: DiagramData = {
      ...sample,
      nodes: [node({ id: 'need1', type: 'need', label: 'Checkout brief', description: text, ...({
        kind: 'brief',
      } as Record<string, unknown>) })],
      relations: [],
      views: [],
      sequences: [],
      defaultPositions: {},
    }
    const files = serializeToMdFolder(data)
    const md = files['nodes/checkout-brief.md']
    expect(md).toContain('type: "need"')
    expect(md.split('---').slice(2).join('---').trim()).toBe(text)
    const back = deserializeFromMdFolder(files).data.nodes[0] as unknown as Record<string, unknown>
    expect(back.description).toBe(text)
    expect(back.kind).toBe('brief')
  })

  it('does not confuse numeric-looking strings with numbers', () => {
    const data: DiagramData = {
      nodes: [node({ id: 'n1', type: 'adr', label: '123', ...({ date: '2026-01-01', ref: '007' } as Record<string, unknown>) })],
      relations: [],
    }
    const { data: back } = deserializeFromMdFolder(serializeToMdFolder(data))
    const n = back.nodes[0] as unknown as Record<string, unknown>
    expect(n.label).toBe('123')
    expect(n.ref).toBe('007')
    expect(n.date).toBe('2026-01-01')
  })

  it('produces deterministic output regardless of store ordering (git-friendly)', () => {
    const shuffled: DiagramData = {
      ...sample,
      nodes: [...sample.nodes].reverse(),
      relations: [...(sample.relations ?? [])].reverse(),
    }
    const a = serializeToMdFolder(sample, 'Demo')
    const b = serializeToMdFolder(shuffled, 'Demo')
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort())
    for (const path of Object.keys(a)) {
      expect(b[path]).toBe(a[path])
    }
  })

  it('sorts custom frontmatter keys and ends JSON sidecars with a newline', () => {
    const files = serializeToMdFolder(sample)
    const adrPath = Object.keys(files).find((p) => p.startsWith('nodes/use-event-sourcing'))!
    const front = files[adrPath].split('---')[1]
    const keyLines = front
      .split('\n')
      .map((l) => l.match(/^([a-zA-Z_]+):/)?.[1])
      .filter((k): k is string => !!k && !['id', 'type', 'label'].includes(k))
    expect(keyLines).toEqual([...keyLines].sort())
    expect(files['_layout.json'].endsWith('\n')).toBe(true)
    expect(files['relations.json'].endsWith('\n')).toBe(true)
  })
})

describe('a custom metamodel in a folder', () => {
  it('keeps the order of its node and relation types', () => {
    // The file's keys were sorted: types read back A–Z by id, and the
    // metamodel editor's list and the palette changed order after a reload.
    const mm = builtInC4Metamodel()
    const nodeTypes = Object.fromEntries([['zeta', { ...mm.nodeTypes.system, id: 'zeta', label: 'Zeta' }], ['alpha', { ...mm.nodeTypes.system, id: 'alpha', label: 'Alpha' }], ...Object.entries(mm.nodeTypes)])
    const relationTypes = Object.fromEntries([['zz', { ...Object.values(mm.relationTypes)[0], id: 'zz' }], ...Object.entries(mm.relationTypes)])
    const metamodel = { ...mm, id: 'custom', nodeTypes, relationTypes }
    const back = deserializeFromMdFolder(serializeToMdFolder({ nodes: [], relations: [], metamodel }, 'Types')).data.metamodel!
    expect(Object.keys(back.nodeTypes)).toEqual(Object.keys(nodeTypes))
    expect(Object.keys(back.relationTypes)).toEqual(Object.keys(relationTypes))
  })
})

describe('md-folder ownership', () => {
  it('reports where each node was written', () => {
    const { files, nodePaths } = serializeToMdFolderWithPaths(sample)
    expect(nodePaths.sys1).toBe('nodes/payment-system/_index.md')
    expect(nodePaths.db1).toBe('nodes/payment-system/api/ledger-db.md')
    for (const path of Object.values(nodePaths)) expect(files[path]).toBeDefined()
  })

  it('prunes only files the format owns', () => {
    const next = serializeToMdFolder(sample)
    const existing = {
      ...next,
      'nodes/old-name.md': '---\nid: "gone"\ntype: "system"\n---\n', // a node we wrote earlier
      'hubTemplates.json': '{}', // a sidecar we wrote earlier
      'package.json': '{}', // not ours
      'tsconfig.json': '{}', // not ours
      'nodes/README.md': '# Notes\n', // hand-written, no frontmatter
      'nodes/draft.md': '---\ntitle: "x"\n---\n', // frontmatter without id/type
      'docs/intro.md': '---\nid: "a"\ntype: "system"\n---\n', // outside nodes/
    }
    expect(staleMdFolderFiles(existing, next).sort()).toEqual(['hubTemplates.json', 'nodes/old-name.md'])
  })
})

describe('a sidecar file that cannot be read', () => {
  // Read as "no such file", a relations.json with a trailing comma (or git
  // conflict markers, or caught half written) gave a model with no
  // relations, and the next save removed the file as stale.
  const model: DiagramData = {
    nodes: [
      { id: 'a', type: 'system', label: 'A', collapsed: false, x: 0, y: 0, width: 200, height: 100 },
      { id: 'b', type: 'system', label: 'B', collapsed: false, x: 300, y: 0, width: 200, height: 100 },
    ],
    relations: [{ id: 'ab', sourceId: 'a', targetId: 'b', label: 'uses' }],
    views: [{ id: 'v', name: 'View', nodeIds: [], positions: {} }],
  }
  const files = (): Record<string, string> => serializeToMdFolder(model, 'model')

  for (const path of ['relations.json', 'views.json', '_layout.json']) {
    it(`${path} with a trailing comma is an error that names the file`, () => {
      const broken = files()
      expect(broken[path]).toBeDefined()
      broken[path] = broken[path].replace(/\]\s*$|\}\s*$/, (end) => `,${end}`)
      expect(() => JSON.parse(broken[path])).toThrow()
      expect(() => deserializeFromMdFolder(broken)).toThrow(MalformedFolderFileError)
      expect(() => deserializeFromMdFolder(broken)).toThrow(path)
    })
  }

  it('a file cut short, or emptied, the same', () => {
    const cut = files()
    cut['relations.json'] = cut['relations.json'].slice(0, 20)
    expect(() => deserializeFromMdFolder(cut)).toThrow(/relations\.json/)
    const empty = { ...files(), 'views.json': '' }
    expect(() => deserializeFromMdFolder(empty)).toThrow(/views\.json/)
  })

  it('a folder without the file still reads as having none', () => {
    const without = files()
    delete without['relations.json']
    expect(deserializeFromMdFolder(without).data.relations).toEqual([])
  })
})

describe('a node file in a folder model', () => {
  const model = (): DiagramData => ({
    nodes: [
      { id: 'shop', type: 'system', label: 'Shop', collapsed: false, x: 0, y: 0, width: 600, height: 400 },
      { id: 'api', type: 'container', label: 'API', collapsed: false, parentId: 'shop', x: 40, y: 120, width: 240, height: 160 } as C4Node,
    ],
    relations: [],
    defaultPositions: { shop: { x: 0, y: 0, width: 600, height: 400 }, api: { x: 40, y: 120, width: 240, height: 160 } },
  })

  it('keeps a property whose key has a space, a dot or a non-ASCII letter', () => {
    // The reader took keys of letters, digits, _ and - only and skipped the
    // rest: the value was gone after a reload, and from the file after the
    // next save.
    const data = model()
    Object.assign(data.nodes[1], { 'SLA target': '99.9%', 'właściciel': 'Ola', 'owner.email': 'a@b.c', 'quote"d': 'x' })
    const back = deserializeFromMdFolder(serializeToMdFolder(data, 'model')).data.nodes.find((n) => n.id === 'api') as unknown as Record<string, unknown>
    expect(back['SLA target']).toBe('99.9%')
    expect(back['właściciel']).toBe('Ola')
    expect(back['owner.email']).toBe('a@b.c')
    expect(back['quote"d']).toBe('x')
  })

  it('with git conflict markers is an error that names it', () => {
    // Skipped as "no node", the element vanished without a word and the
    // next save dropped its layout.
    const files = serializeToMdFolder(model(), 'model')
    const path = Object.keys(files).find((p) => p.startsWith('nodes/') && files[p].includes('"API"'))!
    files[path] = `<<<<<<< HEAD\n${files[path]}=======\n${files[path].replace('API', 'API v2')}>>>>>>> feature\n`
    expect(() => deserializeFromMdFolder(files)).toThrow(MalformedFolderFileError)
    expect(() => deserializeFromMdFolder(files)).toThrow(path)
  })

  it('saved with a byte-order mark is still the element it was', () => {
    // Notepad, PowerShell 5 and Visual Studio may save UTF-8 with a BOM. The
    // browser drops it when it reads the file, Node does not: for the MCP
    // server and \`radical check\` the element was gone, its relations
    // dangled, and the agent's next write dropped its places.
    const files = serializeToMdFolder(model(), 'model')
    const path = Object.keys(files).find((p) => p.startsWith('nodes/') && files[p].includes('"API"'))!
    files[path] = '\uFEFF' + files[path]
    files['_layout.json'] = '\uFEFF' + files['_layout.json']
    const api = deserializeFromMdFolder(files).data.nodes.find((n) => n.id === 'api')
    expect(api?.label).toBe('API')
    expect(api?.parentId).toBe('shop')
    expect(staleMdFolderFiles(files, {})).toContain(path)
  })

  it('whose label has a character outside the BMP at the 60th place keeps a file name the disk keeps', () => {
    // The name was cut at 60 UTF-16 units, through the character: the disk
    // wrote U+FFFD for the half left, and the next write's pass over stale
    // files deleted the element's file.
    const data = model()
    data.nodes[1].label = `${'a'.repeat(59)}\u{20000}\u{20001}`
    const files = serializeToMdFolder(data, 'model')
    const paths = Object.keys(files)
    expect(paths.filter((p) => /[\uD800-\uDFFF]/u.test(p))).toEqual([])
    // Read back from a disk that writes a lone surrogate as U+FFFD.
    const disk = Object.fromEntries(Object.entries(files).map(([p, c]) => [p.replace(/[\uD800-\uDFFF]/gu, '\uFFFD'), c]))
    expect(staleMdFolderFiles(disk, serializeToMdFolder(deserializeFromMdFolder(disk).data, 'model'))).toEqual([])
  })

  it('that _layout.json does not know gets its type\'s size, not 0×0', () => {
    // A file written by hand or brought in by git: drawn and saved with no
    // size at all.
    const files = serializeToMdFolder(model(), 'model')
    files['nodes/shop/search.md'] = '---\nid: "search"\ntype: "database"\nlabel: "Search Index"\n---\n'
    const search = deserializeFromMdFolder(files).data.nodes.find((n) => n.id === 'search')!
    expect(search.width).toBeGreaterThan(0)
    expect(search.height).toBeGreaterThan(0)
  })
})
