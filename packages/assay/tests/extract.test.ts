import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractRepository, factIndex, linkRepositories, parseFacts, pathMatches, repositoriesIn, serializeFacts, urlPathOf } from '../src/index'
import { REPOSITORIES, shop } from './shop'

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

describe('radical assay: facts', () => {
  it('reads a repository\'s units, dependencies, API, URL paths and tests, each with its file and line', () => {
    const dir = shop()
    const orders = extractRepository(join(dir, 'orders-service'))
    expect(orders.units).toEqual([expect.objectContaining({
      id: 'orders-service:unit:.', name: 'orders-service', path: '.', stack: 'npm', kind: 'app', why: 'it has a start script', technology: ['Express', 'Node.js'],
      evidence: { file: 'package.json', line: 2 },
    })])
    expect(orders.dependencies.map((d) => [d.package, d.evidence.line])).toEqual([['@shop/lib', 8], ['express', 9]])
    expect(orders.apis.map((a) => [a.method, a.path, a.evidence])).toEqual([
      ['POST', '/api/orders', { file: 'openapi.yaml', line: 9 }],
      ['GET', '/api/orders/{id}', { file: 'openapi.yaml', line: 12 }],
    ])

    const lib = extractRepository(join(dir, 'shop-lib'))
    expect(lib.units[0]).toMatchObject({ name: '@shop/lib', kind: 'library', description: 'Money and order types shared by the shop\'s services.' })

    const store = extractRepository(join(dir, 'storefront'))
    // The root names workspaces: it is their shell, not a unit.
    expect(store.units.map((u) => [u.id, u.kind, u.technology])).toEqual([['storefront:unit:apps/web', 'app', ['Node.js', 'React']]])
    expect(store.urls.map((u) => [u.path, u.evidence])).toEqual([
      ['/api/orders/{}', { file: 'apps/web/src/orders.js', line: 2 }],
      ['/api/orders', { file: 'apps/web/src/orders.js', line: 3 }],
    ])
    expect(store.tests).toEqual([
      { id: 'storefront:test:apps/web/tests/orders.test.js › orders › shows an order', unit: 'storefront:unit:apps/web', test: 'apps/web/tests/orders.test.js › orders › shows an order', status: 'passed', evidence: { file: 'apps/web/tests/orders.test.js', line: 3 } },
      { id: 'storefront:test:apps/web/tests/orders.test.js › orders › places an order', unit: 'storefront:unit:apps/web', test: 'apps/web/tests/orders.test.js › orders › places an order', status: 'failed', evidence: { file: 'apps/web/tests/orders.test.js', line: 4 } },
    ])
    expect(store.notes).toEqual([])
  })

  it('round-trips the facts file without the folder', () => {
    const facts = extractRepository(join(shop(), 'storefront'))
    const text = serializeFacts(facts)
    expect(text).not.toContain(facts.dir)
    expect(parseFacts(text, facts.dir)).toEqual(facts)
  })

  it('names URL paths, not files or text', () => {
    expect(urlPathOf('/orders/:id')).toBe('/orders/{}')
    expect(urlPathOf('https://x.example.com/api/v1/items?x=1')).toBe('/api/v1/items')
    expect(urlPathOf('${BASE}/users/${id}/')).toBe('/users/{}')
    expect(urlPathOf('/users/{id}')).toBe('/users/{}')
    for (const not of ['/logo.svg', '/', '//cdn.example.com/x', '/ a b', '/{}/{}', 'orders', '/usr/bin/env node', '/usr/local/bin', '/dev/null', '/Users/me/x']) expect(urlPathOf(not)).toBeNull()
  })

  it('finds every workspace this repository\'s mapping names', () => {
    const facts = extractRepository(ROOT, { reports: [] })
    const mapped = (JSON.parse(readFileSync(join(ROOT, '.radical/radical.json'), 'utf8')) as { implements: Array<{ paths: string[] }> }).implements
      .flatMap((m) => m.paths).filter((p) => /^(apps|packages)\/[^/]+$/.test(p))
    expect(mapped.length).toBeGreaterThan(5)
    expect(mapped.filter((p) => !facts.units.some((u) => u.path === p))).toEqual([])
    expect(facts.units.find((u) => u.path === 'apps/cli')).toMatchObject({ name: '@radicaltools/cli', kind: 'app' })
    expect(facts.units.find((u) => u.path === 'packages/common')).toMatchObject({ name: '@radical/common', kind: 'library' })
    expect(facts.units.find((u) => u.path === 'apps/vscode')).toMatchObject({ kind: 'app', why: 'it is a VS Code extension' })
    expect(facts.units.find((u) => u.path === 'apps/web')).toMatchObject({ kind: 'app', why: 'it has an index.html' })
    // The OpenAPI description of a test fixture is no API this repository serves.
    expect(facts.apis).toEqual([])
    expect(linkRepositories([facts]).filter((l) => l.kind === 'http')).toEqual([])
  })
})

describe('radical assay: repositories', () => {
  it('takes a directory of repositories as each of them, and leaves out a folder that is none', () => {
    const dir = shop()
    const found = repositoriesIn([dir])
    expect(found.dirs).toEqual(REPOSITORIES.map((r) => join(dir, r)))
    expect(found.empty).toEqual([])
    expect(repositoriesIn(['shop-lib'], dir).dirs).toEqual([join(dir, 'shop-lib')])
  })

  it('reads the commit of a repository that has one', () => {
    const dir = join(shop(), 'shop-lib')
    expect(extractRepository(dir).commit).toBeUndefined()
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: dir })
    expect(extractRepository(dir).commit).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('radical assay: links', () => {
  it('links a package dependency as observed and a declared path the code names as inferred, citing both sides', () => {
    const dir = shop()
    const repos = REPOSITORIES.map((r) => extractRepository(join(dir, r)))
    const links = linkRepositories(repos)
    expect(links.map((l) => [l.kind, l.from, l.to, l.confidence, l.detail])).toEqual([
      ['http', 'storefront:unit:apps/web', 'orders-service:unit:.', 'inferred', 'GET /api/orders/{id}, POST /api/orders'],
      ['package', 'orders-service:unit:.', 'shop-lib:unit:.', 'observed', 'depends on @shop/lib'],
      ['package', 'storefront:unit:apps/web', 'shop-lib:unit:.', 'observed', 'depends on @shop/lib'],
    ])
    const http = links[0]
    const index = factIndex(repos, links)
    expect(http.facts.map((id) => index.get(id)?.repository).sort()).toEqual(['orders-service', 'orders-service', 'storefront', 'storefront'])
  })

  it('matches a path segment by segment', () => {
    expect(pathMatches('/orders/{}', '/orders/{id}')).toBe(true)
    expect(pathMatches('/orders/42', '/orders/{id}')).toBe(true)
    expect(pathMatches('/{}/42', '/orders/{id}')).toBe(false)
    expect(pathMatches('/orders', '/orders/{id}')).toBe(false)
  })
})
