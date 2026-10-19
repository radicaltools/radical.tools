import { describe, it, expect, vi } from 'vitest'
import { MdFolderSession, mergeMdFolderFiles, type MdFolderStorage } from '../src/formats/mdFolderSync'
import { deserializeFromMdFolder, isMdFolderModelPath, serializeToMdFolder } from '../src/formats/mdFolder'
import type { C4Node, DiagramData } from '../src/c4'

/** In-memory folder. Every write bumps a file's stamp, like an mtime would. */
function memStorage(initial: Record<string, string> = {}) {
  const files = new Map<string, { content: string; stamp: string }>()
  let clock = 0
  const put = (path: string, content: string): string => {
    const stamp = `t${++clock}`
    files.set(path, { content, stamp })
    return stamp
  }
  for (const [path, content] of Object.entries(initial)) put(path, content)
  const storage: MdFolderStorage = {
    list: async () => {
      const out: Record<string, string> = {}
      for (const [path, f] of files) if (isMdFolderModelPath(path)) out[path] = f.stamp
      return out
    },
    read: async (path) => {
      const f = files.get(path)
      if (!f) throw new Error('NotFound')
      return f.content
    },
    write: vi.fn(async (path: string, content: string) => put(path, content)),
    remove: vi.fn(async (path: string) => { files.delete(path) }),
  }
  return {
    storage,
    /** An edit made outside the app. */
    edit: (path: string, content: string) => put(path, content),
    /** Rewrite a file with the same content (new stamp). */
    touch: (path: string) => put(path, files.get(path)!.content),
    drop: (path: string) => files.delete(path),
    content: (path: string) => files.get(path)?.content,
    paths: () => [...files.keys()].sort(),
  }
}

const node = (id: string, body = ''): string => `---\nid: "${id}"\ntype: "system"\n---\n${body}`

const MODEL = {
  'radical.md': '---\nradicalFormat: "md-folder"\n---\n',
  'nodes/a.md': node('a'),
  'nodes/b.md': node('b'),
  'relations.json': '[]\n',
}

describe('MdFolderSession', () => {
  it('reads only model files', async () => {
    const fs = memStorage({ ...MODEL, 'package.json': '{}', 'docs/x.md': 'x' })
    const session = new MdFolderSession(fs.storage)
    expect(await session.readAll()).toEqual(MODEL)
  })

  it('writes only files whose content changed, and prunes stale owned files', async () => {
    const fs = memStorage({ ...MODEL, 'nodes/README.md': '# notes\n', 'package.json': '{}' })
    const session = new MdFolderSession(fs.storage)
    await session.readAll()
    const next = { ...MODEL, 'nodes/a.md': node('a', 'changed') }
    delete (next as Record<string, string>)['nodes/b.md']

    expect(await session.write(next)).toEqual({ ok: true })
    expect(fs.storage.write).toHaveBeenCalledTimes(1)
    expect(fs.storage.write).toHaveBeenCalledWith('nodes/a.md', node('a', 'changed'))
    expect(fs.storage.remove).toHaveBeenCalledTimes(1)
    expect(fs.paths()).toEqual(['nodes/README.md', 'nodes/a.md', 'package.json', 'radical.md', 'relations.json'])
  })

  it('refuses to write over an edit made outside the app, and reports it', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    const onChange = vi.fn()
    session.onExternalChange = onChange
    await session.readAll()
    fs.edit('nodes/b.md', node('b', 'edited in vim'))

    const res = await session.write({ ...MODEL, 'nodes/a.md': node('a', 'app edit') })
    expect(res).toEqual({ ok: false, conflict: ['nodes/b.md'] })
    expect(fs.storage.write).not.toHaveBeenCalled()
    expect(fs.content('nodes/b.md')).toBe(node('b', 'edited in vim'))
    expect(onChange).toHaveBeenCalledWith(['nodes/b.md'])

    // Once the app has re-read the folder, writing works again.
    await session.readAll()
    expect(await session.write({ ...MODEL, 'nodes/b.md': node('b', 'edited in vim') })).toEqual({ ok: true })
  })

  it('treats files added or deleted outside the app as conflicts too', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    await session.readAll()
    fs.edit('nodes/c.md', node('c'))
    fs.drop('nodes/a.md')
    expect(await session.write(MODEL)).toEqual({ ok: false, conflict: ['nodes/a.md', 'nodes/c.md'] })
  })

  it('ignores a file rewritten with the same content', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    await session.readAll()
    fs.touch('nodes/a.md')
    expect(await session.poll()).toEqual([])
    expect(await session.write(MODEL)).toEqual({ ok: true })
  })

  it('polls: reports an outside edit once, and never its own writes', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    const onChange = vi.fn()
    session.onExternalChange = onChange
    await session.readAll()

    await session.write({ ...MODEL, 'nodes/a.md': node('a', 'app edit') })
    expect(await session.poll()).toEqual([])

    fs.edit('nodes/b.md', node('b', 'git pull'))
    expect(await session.poll()).toEqual(['nodes/b.md'])
    expect(await session.poll()).toEqual([]) // already reported
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not poll a folder it never read', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    fs.edit('nodes/a.md', node('a', 'x'))
    expect(await session.poll()).toEqual([])
  })

  it('takes the folder as it is on a first write without a read', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    expect(await session.write({ ...MODEL, 'nodes/a.md': node('a', 'new') })).toEqual({ ok: true })
    expect(fs.storage.write).toHaveBeenCalledTimes(1)
  })

  it('merges a write with an outside edit when given a merge, and refuses a folder it cannot read', async () => {
    const system = (id: string, label: string): C4Node =>
      ({ id, type: 'system', label, x: 0, y: 0, width: 200, height: 100, collapsed: false }) as C4Node
    const model: DiagramData = { nodes: [system('shop', 'Shop'), system('bank', 'Bank')], relations: [] }
    const files = serializeToMdFolder(model, 'Books')
    const fs = memStorage(files)
    const session = new MdFolderSession(fs.storage)
    const onChange = vi.fn()
    session.onExternalChange = onChange
    await session.readAll()
    const shopPath = Object.keys(files).find((p) => files[p].includes('Shop'))!
    // An agent describes the bank and adds a node; the app describes the shop.
    const agent = deserializeFromMdFolder(files).data
    agent.nodes.find((n) => n.id === 'bank')!.technology = 'Stripe'
    agent.nodes.push(system('stock', 'Stock'))
    const agentFiles = serializeToMdFolder(agent, 'Books')
    for (const [path, content] of Object.entries(agentFiles)) if (files[path] !== content) fs.edit(path, content)
    const bankPath = Object.keys(agentFiles).find((p) => agentFiles[p].includes('Stripe'))!
    const ours = deserializeFromMdFolder(files).data
    ours.nodes.find((n) => n.id === 'shop')!.description = 'Sells books'

    const res = await session.write(serializeToMdFolder(ours, 'Books'), mergeMdFolderFiles)
    expect(res.ok && res.merged).toEqual({ changed: expect.arrayContaining([bankPath]), conflicts: [] })
    const onDisk = deserializeFromMdFolder(Object.fromEntries(fs.paths().map((p) => [p, fs.content(p)!]))).data
    expect(onDisk.nodes.map((n) => [n.label, n.description ?? '', n.technology ?? '']).sort()).toEqual([['Bank', '', 'Stripe'], ['Shop', 'Sells books', ''], ['Stock', '', '']])
    // The agent's files are left as it wrote them; the app is told to reload.
    expect(fs.storage.write).toHaveBeenCalledTimes(1)
    expect(fs.storage.write).toHaveBeenCalledWith(shopPath, expect.stringContaining('Sells books'))
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([bankPath]))

    // A file broken outside the app is not merged over: nothing is written.
    fs.edit(bankPath, '---\nid: [broken\n---\n')
    const refused = await session.write(serializeToMdFolder(ours, 'Books'), mergeMdFolderFiles)
    expect(refused).toEqual({ ok: false, conflict: [bankPath] })
    expect(fs.storage.write).toHaveBeenCalledTimes(1)
  })

  it('skips a poll while a write is running instead of queueing it', async () => {
    const fs = memStorage(MODEL)
    const session = new MdFolderSession(fs.storage)
    await session.readAll()
    const writing = session.write({ ...MODEL, 'nodes/a.md': node('a', 'new') })
    expect(await session.poll()).toEqual([])
    await writing
  })
})
