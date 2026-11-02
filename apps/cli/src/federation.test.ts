import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import { builtInC4Metamodel } from '@radical/common/metamodel'
import { deserializeFromMdFolder, serializeToMdFolder, type FolderFiles } from '@radical/common/formats/mdFolder'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { otherModelsAt, parseFederationFile, withOtherModels } from '@radical/common/federation'
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
    views: [{ id: 'v-ord', name: 'Landscape', folder: 'Context', nodeIds: ['ord', 'cust'], positions: {} }],
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
  it('fetches the other models with their origin into .radical/federation.json', async () => {
    const { home, pinned } = await repos({ ownRelation: true })
    const short = pinned.slice(0, 7)
    const before = await readFolder(home)

    const fetched = await run(home, ['federation', 'fetch'])
    expect(fetched.err).toBe('')
    expect(fetched.code).toBe(0)
    expect(fetched.out).toBe(`Fetched orders@${short} (${pinned}): 2 elements into .radical/federation.json.\n`.replace(` (${pinned})`, ''))
    const file = parseFederationFile(await readFile(join(home, '.radical/federation.json'), 'utf8'))!
    expect(file).toMatchObject({ version: 2, name: 'payments', notes: [] })
    expect(file.dependencies).toEqual([{ name: 'orders', repo: expect.any(String), path: 'architecture', ref: pinned, commit: pinned }])
    expect(file.nodes.map((n) => [n.id, n.origin]).sort()).toEqual([['cust', `orders@${short}`], ['ord', `orders@${short}`]])
    expect(file.relations.map((r) => [r.id, r.origin])).toEqual([['r-buys', `orders@${short}`]])
    expect(file.views).toEqual([expect.objectContaining({ id: 'v-ord', name: 'Landscape', folder: 'Context', origin: `orders@${short}` })])
    // The model's own files are as they were, and .radical/ stays out of git.
    expect(await readFolder(home)).toEqual(before)
    expect(await readFile(join(home, '.radical/.gitignore'), 'utf8')).toBe('*\n')
    expect((await git(home, 'status', '--porcelain')).stdout).toBe('')
    // Read with the folder, the relation to Orders holds.
    const data = withOtherModels(await readModel(home), file)
    expect(data.relations.find((r) => r.id === 'r-reads')).toMatchObject({ sourceId: 'pay', targetId: 'ord' })

    // Quiet, as the hooks run it; a folder without deps.json has nothing to fetch.
    expect((await run(home, ['federation', 'fetch', '--quiet'])).out).toBe('')
    await rm(join(home, 'deps.json'))
    const none = await run(home, ['federation', 'fetch'])
    expect(none.code).toBe(0)
    expect(none.out).toContain('No deps.json in .: this model depends on no other model, so there is nothing to fetch.')
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

  it('fetches the versions of the other models the milestones keep', async () => {
    const { orders, home, pinned, deps } = await repos()
    const model = await readModel(home)
    await writeModel(home, { ...model, snapshots: [{ id: 's1', name: 'As-is', timestamp: 1, nodes: {}, relations: {}, otherModels: [{ name: 'orders', commit: pinned }] }] }, 'payments')
    // orders moves on, and the pin with it.
    const was = await readModel(join(orders, 'architecture'))
    await writeModel(join(orders, 'architecture'), { ...was, nodes: was.nodes.map((n) => (n.id === 'ord' ? { ...n, label: 'Order Service' } : n)) }, 'orders')
    await git(orders, 'add', '-A')
    await git(orders, 'commit', '-qm', 'renamed')
    const now = await head(orders)
    await deps(now)

    const fetched = await run(home, ['federation', 'fetch'])
    expect(fetched.err).toBe('')
    expect(fetched.code).toBe(0)
    const file = parseFederationFile(await readFile(join(home, '.radical/federation.json'), 'utf8'))!
    expect(file.nodes.map((n) => n.label), fetched.out).toContain('Order Service')
    const old = `orders@${pinned.slice(0, 7)}`
    expect(file.atCommits?.[old]?.nodes.find((n) => n.id === 'ord')).toMatchObject({ label: 'Orders', origin: old })
    expect(otherModelsAt(file, [{ name: 'orders', commit: pinned }]).nodes.find((n) => n.id === 'ord')?.label).toBe('Orders')
  })

  it('says what is wrong with a dependency it cannot fetch', async () => {
    const { home, deps } = await repos()
    await deps('no-such-branch')
    const fetched = await run(home, ['federation', 'fetch'])
    expect(fetched.code).toBe(2)
    expect(fetched.err).toContain('dependency orders')
    expect((await run(home, ['federation', 'open'])).code).toBe(2)
    expect((await run(home, ['check'])).code).toBe(2)
    expect((await run(home, ['federation', 'nope'])).code).toBe(2)
  })
})

describe('transitive dependencies', () => {
  /** orders (v1: Orders; v2: Orders and Invoices), billing, which depends
   *  on orders v1 by a path, and payments, which depends on billing and,
   *  given `ordersRef`, on orders itself. */
  async function chain(ordersRef?: string) {
    const top = await mkdtemp(join(tmpdir(), 'radical-federation-'))
    dirs.push(top)
    const repo = async (name: string) => { const dir = join(top, name); await mkdir(dir); await git(dir, 'init', '-q', '-b', 'main'); return dir }
    const commit = async (dir: string, message: string, tag?: string) => {
      await git(dir, 'add', '.')
      await git(dir, 'commit', '-q', '-m', message)
      if (tag) await git(dir, 'tag', tag)
    }
    const orders = await repo('orders')
    await writeModel(join(orders, 'architecture'), { nodes: [node('ord', 'system', 'Orders')], relations: [] }, 'orders')
    await commit(orders, 'v1', 'v1')
    await writeModel(join(orders, 'architecture'), { nodes: [node('ord', 'system', 'Orders'), node('inv', 'system', 'Invoices')], relations: [] }, 'orders')
    await commit(orders, 'v2', 'v2')

    const billing = await repo('billing')
    const billingHome = join(billing, 'architecture')
    await writeModel(billingHome, { nodes: [node('bill', 'system', 'Billing')], relations: [{ id: 'r-bill', sourceId: 'bill', targetId: 'ord', label: 'bills orders' }] }, 'billing')
    await writeFile(join(billingHome, 'deps.json'), JSON.stringify({ name: 'billing', dependencies: [{ name: 'orders', repo: relative(billingHome, orders), path: 'architecture', ref: 'v1' }] }))
    await commit(billing, 'billing model')

    const payments = await repo('payments')
    const home = join(payments, 'architecture')
    await writeModel(home, { nodes: [node('pay', 'system', 'Payments')], relations: [{ id: 'r-pay', sourceId: 'pay', targetId: 'bill', label: 'asks for bills' }, { id: 'r-ord', sourceId: 'pay', targetId: 'ord', label: 'reads orders' }] }, 'payments')
    await writeFile(join(home, 'deps.json'), JSON.stringify({
      name: 'payments',
      dependencies: [
        { name: 'billing', repo: relative(home, billing), path: 'architecture', ref: 'main' },
        ...(ordersRef ? [{ name: 'orders', repo: relative(home, orders), path: 'architecture', ref: ordersRef }] : []),
      ],
    }))
    await commit(payments, 'payments model')
    return { home }
  }

  it("brings a dependency's own dependencies, so the relations between them hold", async () => {
    const { home } = await chain()
    const check = await run(home, ['check', '--format', 'json'])
    const result = JSON.parse(check.out) as CheckResult & { federation: Array<{ name: string; ref: string; via?: string }> }
    expect(result.federation).toEqual([
      expect.objectContaining({ name: 'billing', ref: 'main' }),
      expect.objectContaining({ name: 'orders', ref: 'v1', via: 'billing' }),
    ])
    expect(result.findings.filter((f) => f.severity === 'error')).toEqual([])
  })

  it('composes a model pinned twice at the nearest pin, and says which one it left', async () => {
    const { home } = await chain('v2')
    const check = await run(home, ['check'])
    expect(check.out).toContain('Note: orders: billing pins v1, payments pins v2; v2 is composed, the nearer pin (pin it in deps.json to choose).')
    const json = JSON.parse((await run(home, ['check', '--format', 'json'])).out) as { federation: Array<{ name: string; ref: string; via?: string }> }
    expect(json.federation.find((d) => d.name === 'orders')).toEqual(expect.objectContaining({ ref: 'v2' }))
    expect(json.federation.find((d) => d.name === 'orders')?.via).toBeUndefined()
  })

  it('knows the model itself and one model under two names by repository and model folder', async () => {
    const top = await mkdtemp(join(tmpdir(), 'radical-federation-'))
    dirs.push(top)
    const repo = async (name: string, nodes: C4Node[], deps?: (home: string) => object) => {
      const dir = join(top, name)
      await mkdir(dir)
      await git(dir, 'init', '-q', '-b', 'main')
      const home = join(dir, 'architecture')
      await writeModel(home, { nodes, relations: [] }, name)
      if (deps) await writeFile(join(home, 'deps.json'), JSON.stringify(deps(home)))
      await git(dir, 'add', '.')
      await git(dir, 'commit', '-q', '-m', name)
      return { dir, home }
    }
    const orders = await repo('orders', [node('ord', 'system', 'Orders')])
    const paymentsHome = join(top, 'payments', 'architecture')
    // billing names orders "ordering", and payments "pay-svc": the same
    // repositories and model folders payments names otherwise.
    const billing = await repo('billing', [node('bill', 'system', 'Billing')], (home) => ({
      name: 'billing',
      dependencies: [
        { name: 'ordering', repo: relative(home, orders.dir), path: 'architecture', ref: 'main' },
        { name: 'pay-svc', repo: relative(home, join(top, 'payments')), path: './architecture/', ref: 'main' },
        // Its address, written as https where its remote is ssh.
        { name: 'pay-https', repo: 'https://GitHub.com/acme/payments.git', path: 'architecture', ref: 'main' },
      ],
    }))
    const payments = await repo('payments', [node('pay', 'system', 'Payments')], (home) => ({
      name: 'payments',
      dependencies: [
        { name: 'billing', repo: relative(home, billing.dir), path: 'architecture', ref: 'main' },
        { name: 'orders', repo: relative(home, orders.dir), path: 'architecture', ref: 'main' },
      ],
    }))
    await git(payments.dir, 'remote', 'add', 'origin', 'git@github.com:acme/payments.git')
    const fetched = await run(paymentsHome, ['federation', 'fetch'])
    expect(fetched.err).toBe('')
    expect(fetched.code).toBe(0)
    expect(fetched.out).toContain('Note: pay-https: billing names this model so; left out, as a dependency back to it.')
    expect(fetched.out).toContain('Note: ordering: billing names the model orders so (the same repository and model folder); fetched once, as orders.')
    expect(fetched.out).toContain('Note: pay-svc: billing names this model so; left out, as a dependency back to it.')
    const file = parseFederationFile(await readFile(join(paymentsHome, '.radical/federation.json'), 'utf8'))!
    expect(file.dependencies.map((d) => d.name)).toEqual(['billing', 'orders'])
    expect(file.nodes.map((n) => n.id).sort()).toEqual(['bill', 'ord'])
  })
})
