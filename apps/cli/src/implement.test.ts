import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { C4Node } from '@radical/common/c4'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { main } from './cli'

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** A git repository with its model in .radical/model: a system Shop with
 *  two containers, and another system with an element of the same name. */
async function repository(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'radical-implement-')))
  dirs.push(root)
  await exec('git', ['init', '-q'], { cwd: root })
  const nodes = [
    node('shop', 'system', 'Shop'), node('orders', 'container', 'Orders API', { parentId: 'shop' }), node('billing', 'container', 'Billing API', { parentId: 'shop' }),
    node('legacy', 'system', 'Legacy'), node('old-orders', 'container', 'Orders API', { parentId: 'legacy' }),
  ]
  for (const [path, content] of Object.entries(serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes, relations: [] }, 'shop'))) {
    await mkdir(dirname(join(root, '.radical', 'model', path)), { recursive: true })
    await writeFile(join(root, '.radical', 'model', path), content)
  }
  for (const dir of ['services/billing', 'services/orders']) await mkdir(join(root, dir), { recursive: true })
  return root
}

async function run(cwd: string, ...args: string[]) {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical implement', () => {
  it('maps an element by its name or id, and refuses a name that matches none or several', async () => {
    const root = await repository()
    const billing = await run(join(root, 'services'), 'implement', 'billing api', '--path', 'billing')
    expect(billing).toMatchObject({ code: 0, err: '' })
    expect(billing.out).toContain('+ container "Billing API" (billing) is built in services/billing (../.radical/radical.json)')
    expect(await readFile(join(root, '.radical', 'radical.json'), 'utf8')).toBe('{\n  "implements": [\n    { "element": "billing", "name": "Billing API", "paths": ["services/billing"] }\n  ]\n}\n')

    const both = await run(root, 'implement', 'Orders API', '--path', 'services/orders')
    expect(both.code).toBe(2)
    expect(both.err).toContain('2 elements are named "Orders API": name one by its id.')
    for (const line of ['  container "Orders API" (orders)', '  container "Orders API" (old-orders)']) expect(both.err).toContain(line)
    const none = await run(root, 'implement', 'Order', '--path', 'services/orders')
    expect(none.err).toContain('No element named "Order" in the model. Did you mean:\n')
    expect(none.err).toContain('  container "Orders API" (orders)')

    expect((await run(root, 'implement', 'orders', '--path', 'services/orders')).code).toBe(0)
    await run(root, 'implement', 'Shop', '--path', '.')
    expect(JSON.parse(await readFile(join(root, '.radical', 'radical.json'), 'utf8')).implements.map((m: { element: string; paths: string[] }) => [m.element, m.paths]))
      .toEqual([['billing', ['services/billing']], ['orders', ['services/orders']], ['shop', ['.']]])
  })

  it('takes an element out, and says where one is built', async () => {
    const root = await repository()
    await run(root, 'implement', 'Shop', '--path', '.')
    await run(root, 'implement', 'Billing API', '--path', 'services/billing', '--path', 'services/shared')
    expect((await run(root, 'implement', 'Billing API')).out).toContain('container "Billing API" (billing) is built in services/billing, services/shared')
    expect((await run(root, 'implement', 'Billing API', '--remove')).out).toContain('- container "Billing API" (billing) taken out of .radical/radical.json')
    // Without an entry of its own, where its system is.
    expect((await run(root, 'implement', 'Billing API')).out).toContain('container "Billing API" (billing) is built in ., as system "Shop" (shop) is')
    expect((await run(root, 'implement', 'Legacy')).out).toContain('system "Legacy" (legacy) is built nowhere .radical/radical.json says: radical implement legacy --path <folder>')
  })

  it('keeps the keys of the file it does not know', async () => {
    const root = await repository()
    const file = join(root, '.radical', 'radical.json')
    await writeFile(file, JSON.stringify({ $schema: 'https://radical.tools/schema/radical.json', owner: 'team-shop', implements: [{ element: 'orders', paths: ['services/orders'], owner: 'team-orders' }] }))
    expect((await run(root, 'implement', 'orders', '--path', 'services/orders', '--path', 'services/billing')).code).toBe(0)
    await run(root, 'implement', 'Shop', '--path', '.')
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      $schema: 'https://radical.tools/schema/radical.json', owner: 'team-shop',
      implements: [{ element: 'orders', name: 'Orders API', paths: ['services/orders', 'services/billing'], owner: 'team-orders' }, { element: 'shop', name: 'Shop', paths: ['.'] }],
    })
  })

  it('takes out the entry of an element the model no longer has, by its id or its name', async () => {
    const root = await repository()
    const file = join(root, '.radical', 'radical.json')
    await writeFile(file, JSON.stringify({ implements: [{ element: 'gone', name: 'Payments API', paths: ['services/pay'] }, { element: 'went', name: 'Old API', paths: ['services/old'] }, { element: 'orders', paths: ['services/orders'] }] }))
    expect((await run(root, 'implement', 'gone', '--remove')).out).toContain('- "Payments API" (gone), no element of the model, taken out of .radical/radical.json')
    expect((await run(root, 'implement', 'old api', '--remove')).out).toContain('- "Old API" (went), no element of the model, taken out of .radical/radical.json')
    expect(JSON.parse(await readFile(file, 'utf8')).implements.map((m: { element: string }) => m.element)).toEqual(['orders'])
    // An element neither the model nor the file has is still refused.
    expect((await run(root, 'implement', 'nothing', '--remove')).err).toContain('No element named "nothing" in the model.')
  })

  it('outside a git repository, writes the file beside the model folder, where the MCP server reads it', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'radical-implement-')))
    dirs.push(root)
    const folder = join(root, 'shop', 'arch')
    for (const [path, content] of Object.entries(serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [node('shop', 'system', 'Shop')], relations: [] }, 'shop'))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    expect((await run(join(root, 'shop'), 'implement', 'Shop', '--folder', 'arch', '--path', '.')).code).toBe(0)
    expect(JSON.parse(await readFile(join(root, 'shop', '.radical', 'radical.json'), 'utf8')).implements).toEqual([{ element: 'shop', name: 'Shop', paths: ['.'] }])
    expect(existsSync(join(root, '.radical', 'radical.json'))).toBe(false)
  })
})
