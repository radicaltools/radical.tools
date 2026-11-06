import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { shop } from '@radical/assay/fixtures'
import { main } from './cli'

async function run(args: string[], cwd: string) {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical assay extract', () => {
  it('reads the facts of a directory of repositories, writes each one\'s facts file and prints the links, writing no model', async () => {
    const dir = shop()
    const { code, out, err } = await run(['assay', 'extract', '.'], dir)
    expect(err).toBe('')
    expect(code).toBe(0)
    expect(out).toContain('storefront (storefront, no commit): 1 unit, 2 dependencies, 2 URL paths, 1 address, 2 tests.')
    expect(out).toContain('  - link:http:storefront:unit:apps/web->orders-service:unit:.: storefront:unit:apps/web → orders-service:unit:., http, inferred: GET /api/orders/{id}, POST /api/orders')
    expect(out).toContain('Facts written to .radical/assay/facts.json in each repository (a folder of code')
    for (const repo of ['orders-service', 'shop-lib', 'storefront']) {
      expect(JSON.parse(readFileSync(join(dir, repo, '.radical/assay/facts.json'), 'utf8')).format).toBe('radical-assay-facts/1')
      expect(existsSync(join(dir, repo, '.radical/model'))).toBe(false)
    }
  })

  it('takes a repository\'s reports, and prints JSON', async () => {
    const dir = shop()
    const { code, out } = await run(['assay', 'extract', 'storefront', '--report', 'storefront=none', '--json'], dir)
    expect(code).toBe(0)
    const json = JSON.parse(out)
    expect(json.repositories[0]).toMatchObject({ repository: 'storefront', tests: [], notes: ['report none does not exist'] })
  })

  it('says what is wrong', async () => {
    const dir = shop()
    mkdirSync(join(dir, 'empty'))
    expect(await run(['assay', 'extract', 'empty'], dir)).toMatchObject({ code: 2, err: 'No code in empty (Assay clones nothing).\n' })
    expect(await run(['assay', 'extract', '.', '--report', 'web'], dir)).toMatchObject({ code: 2, err: '--report web: write it as <repository>=<path>\n' })
    expect(await run(['assay', 'extract', '.', '--report', 'web=x'], dir)).toMatchObject({ code: 2, err: '--report names no repository of the run: web\n' })
    expect((await run(['assay', 'smelt'], dir)).code).toBe(2)
    expect((await run(['help', 'assay'], dir)).out).toContain('Usage: radical assay extract <directory or .zip>…')
  })
})
