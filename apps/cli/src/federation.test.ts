import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import { builtInC4Metamodel } from '@radical/common/metamodel'
import { deserializeFromMdFolder, serializeToMdFolder, type FolderFiles } from '@radical/common/formats/mdFolder'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { parseModelBase } from '@radical/common/formats/modelBase'
import type { CheckResult } from '@radical/common/check'
import { main } from './cli'

const exec = promisify(execFile)
const dirs: string[] = []
let cacheBefore: string | undefined
beforeEach(async () => {
  cacheBefore = process.env.RADICAL_CACHE
  const cache = await mkdtemp(join(tmpdir(), 'radical-cache-'))
  dirs.push(cache)
  process.env.RADICAL_CACHE = cache
})
afterEach(async () => {
  if (cacheBefore === undefined) delete process.env.RADICAL_CACHE
  else process.env.RADICAL_CACHE = cacheBefore
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const node = (id: string, type: string, label: string): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false }) as C4Node

const git = (cwd: string, ...args: string[]) =>
  exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd })
const head = async (cwd: string) => (await git(cwd, 'rev-parse', 'HEAD')).stdout.trim()

async function readFolder(dir: string): Promise<FolderFiles> {
  const files: FolderFiles = {}
  const walk = async (rel: string): Promise<void> => {
    for (const entry of await readdir(join(dir, rel), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const path = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) await walk(path)
      else files[path] = await readFile(join(dir, path), 'utf8')
    }
  }
  await walk('')
  return files
}
const readModel = async (dir: string): Promise<DiagramData> => deserializeFromMdFolder(await readFolder(dir)).data

/** Writes the model into `dir` as an editor does: the files that changed, stale node files removed. */
async function writeModel(dir: string, data: DiagramData, name: string): Promise<void> {
  const files = serializeToMdFolder({ metamodel: builtInC4Metamodel(), ...data }, name)
  const old = await readFolder(dir).catch(() => ({}) as FolderFiles)
  for (const path of Object.keys(old)) if (path.startsWith('nodes/') && !(path in files)) await rm(join(dir, path))
  for (const [path, content] of Object.entries(files)) {
    if (old[path] === content) continue
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), content)
  }
}

/** Two repositories: orders, with its model in architecture/, and payments,
 *  whose model there depends on orders at `ref` (a commit when not given). */
async function repos(options: { ownRelation?: boolean } = {}) {
  const top = await mkdtemp(join(tmpdir(), 'radical-federation-'))
  dirs.push(top)
  const orders = join(top, 'orders')
  const payments = join(top, 'payments')
  for (const dir of [orders, payments]) {
    await mkdir(dir)
    await git(dir, 'init', '-q', '-b', 'main')
  }
  await writeModel(join(orders, 'architecture'), {
    nodes: [node('ord', 'system', 'Orders'), node('cust', 'person', 'Customer')],
    relations: [{ id: 'r-buys', sourceId: 'cust', targetId: 'ord', label: 'orders' }],
  }, 'orders')
  await writeFile(join(orders, 'code.txt'), 'the code of orders\n')
  await git(orders, 'add', '.')
  await git(orders, 'commit', '-q', '-m', 'orders model')
  const pinned = await head(orders)
  const home = join(payments, 'architecture')
  await writeModel(home, {
    nodes: [node('pay', 'system', 'Payments')],
    relations: options.ownRelation ? [{ id: 'r-reads', sourceId: 'pay', targetId: 'ord', label: 'reads orders' }] : [],
  }, 'payments')
  const deps = (ref: string) => writeFile(join(home, 'deps.json'), JSON.stringify({
    name: 'payments', dependencies: [{ name: 'orders', repo: relative(home, orders), path: 'architecture', ref }],
  }, null, 2))
  await deps(pinned)
  await git(payments, 'add', '.')
  await git(payments, 'commit', '-q', '-m', 'payments model')
  return { orders, payments, home, composed: join(home, '.radical/federation'), pinned, deps }
}

async function run(cwd: string, args: string[], signal?: AbortSignal): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, signal, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

async function until(what: string, test: () => Promise<boolean>, ms = 8000): Promise<void> {
  const end = Date.now() + ms
  while (!(await test().catch(() => false))) {
    if (Date.now() > end) throw new Error(`timed out waiting: ${what}`)
    await new Promise((done) => setTimeout(done, 50))
  }
}

describe('radical federation', () => {
  it('composes the dependencies, carries own changes home and keeps theirs out', async () => {
    const { orders, home, composed, pinned } = await repos()
    const short = pinned.slice(0, 7)

    const open = await run(home, ['federation', 'open'])
    expect(open.err).toBe('')
    expect(open.code).toBe(0)
    expect(open.out).toContain(`Composed into .radical/federation: 1 element of this model and 2 of orders@${short}.`)
    const model = await readModel(composed)
    expect(model.nodes.find((n) => n.id === 'pay')?.origin).toBeUndefined()
    expect(model.nodes.find((n) => n.id === 'ord')).toMatchObject({ label: 'Orders', origin: `orders@${short}` })
    expect(model.relations.find((r) => r.id === 'r-buys')?.origin).toBe(`orders@${short}`)
    // Studio's Changes on branch: the base is composed too.
    const base = parseModelBase(await readFile(join(composed, '.radical/base.json'), 'utf8'))
    expect(base?.nodes.map((n) => n.id).sort()).toEqual(['cust', 'ord', 'pay'])

    // Edited in the composed folder: a relation to Orders, and Orders renamed.
    await writeModel(composed, {
      ...model,
      nodes: model.nodes.map((n) => (n.id === 'ord' ? { ...n, label: 'Orders 2' } : n)),
      relations: [...model.relations, { id: 'r-reads', sourceId: 'pay', targetId: 'ord', label: 'reads orders' }],
    }, 'payments')
    const sync = await run(home, ['federation', 'sync'])
    expect(sync.code).toBe(1)
    expect(sync.out).toContain('Carried the changes home to .')
    expect(sync.out).toContain(`Kept out: the change to element "Orders" of orders@${short} (label); change it in that model's repository.`)

    const own = await readModel(home)
    expect(own.nodes.map((n) => n.id)).toEqual(['pay'])
    expect(own.relations).toEqual([{ id: 'r-reads', sourceId: 'pay', targetId: 'ord', label: 'reads orders' }])
    // The refused rename is undone in the composed folder; orders is as it was.
    expect((await readModel(composed)).nodes.find((n) => n.id === 'ord')?.label).toBe('Orders')
    expect((await git(orders, 'status', '--porcelain')).stdout).toBe('')
    expect((await readModel(join(orders, 'architecture'))).nodes.find((n) => n.id === 'ord')?.label).toBe('Orders')

    expect((await run(home, ['federation', 'sync'])).out).toContain('Nothing to carry home.')
  })

  it('watch carries a change home and composes again after an outside change', async () => {
    const { home, composed } = await repos()
    const stop = new AbortController()
    const watching = run(home, ['federation', 'watch', '--interval', '100'], stop.signal)
    try {
      await until('the federation is composed', async () => (await readModel(composed)).nodes.length === 3)

      const model = await readModel(composed)
      await writeModel(composed, { ...model, nodes: [...model.nodes, node('ledger', 'system', 'Ledger')] }, 'payments')
      await until('Ledger reaches the model folder', async () => (await readModel(home)).nodes.some((n) => n.id === 'ledger'))

      const own = await readModel(home)
      await writeModel(home, { ...own, nodes: [...own.nodes, node('bank', 'system', 'Bank')] }, 'payments')
      await until('Bank reaches the composed folder', async () => (await readModel(composed)).nodes.some((n) => n.id === 'bank'))
      const after = await readModel(composed)
      expect(after.nodes.map((n) => n.id).sort()).toEqual(['bank', 'cust', 'ledger', 'ord', 'pay'])
    } finally {
      stop.abort()
    }
    const result = await watching
    expect(result.code).toBe(0)
    expect(result.err).toBe('')
    expect(result.out).toContain('Carried the changes home')
    expect(result.out).toContain('The model folder changed: composed again')
  })

  it('radical check composes the dependencies and finds a reference to no element', async () => {
    const { orders, home, pinned, deps } = await repos({ ownRelation: true })
    const checked = await run(home, ['check'])
    expect(checked.out).toContain(`Checked with orders@${pinned.slice(0, 7)} (deps.json).`)
    expect(checked.code).toBe(0)

    const alone = JSON.parse((await run(home, ['check', '--alone', '--format', 'json'])).out) as CheckResult
    expect(alone.findings.some((f) => f.code === 'rel-end-missing' && f.relationId === 'r-reads')).toBe(true)

    // Orders goes from its model, and the pin moves.
    const model = await readModel(join(orders, 'architecture'))
    await rm(join(orders, 'architecture'), { recursive: true })
    await writeModel(join(orders, 'architecture'), { nodes: model.nodes.filter((n) => n.id === 'cust'), relations: [] }, 'orders')
    await git(orders, 'add', '-A')
    await git(orders, 'commit', '-q', '-m', 'Orders goes')
    const moved = await head(orders)
    await deps(moved)
    const after = await run(home, ['check', '--format', 'json'])
    expect(after.code).toBe(1)
    const result = JSON.parse(after.out) as CheckResult & { federation: Array<{ name: string; commit: string }> }
    expect(result.federation).toEqual([{ name: 'orders', ref: moved, commit: moved }])
    expect(result.findings.find((f) => f.code === 'rel-end-missing')).toMatchObject({ severity: 'error', relationId: 'r-reads' })
  })

  it('says what is wrong without deps.json or with a dependency it cannot fetch', async () => {
    const { home, deps } = await repos()
    await rm(join(home, 'deps.json'))
    expect((await run(home, ['federation', 'open'])).err).toContain('there is no deps.json in the model folder')
    expect((await run(home, ['federation', 'sync'])).err).toContain('the federation is not open')
    await deps('no-such-branch')
    const open = await run(home, ['federation', 'open'])
    expect(open.code).toBe(2)
    expect(open.err).toContain('dependency orders')
    expect((await run(home, ['check'])).code).toBe(2)
    expect((await run(home, ['federation', 'nope'])).code).toBe(2)
  })
})
