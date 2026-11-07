import { execFileSync, spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { shop } from '@radical/assay/fixtures'
import { FolderModel } from './folderModel'

// Playwright's own Chromium, so a machine without Chrome explores the same way.
process.env.RADICAL_ASSAY_BROWSER = 'chromium'

const PAGES: Record<string, string> = {
  '/': `<!doctype html><title>Shop</title><h1>Shop</h1>
    <nav><a href="/orders">Orders</a> <a href="https://example.com/">Elsewhere</a></nav>
    <form action="/home" method="get">
      <label for="email">Email</label><input id="email" name="email">
      <label for="password">Password</label><input id="password" name="password" type="password">
      <button type="submit">Sign in</button>
    </form>
    <button>Pay now</button> <button>Delete account</button>`,
  '/home': '<!doctype html><title>Home</title><h1>Welcome</h1><a href="/orders">Orders</a>',
  '/orders': '<!doctype html><title>Orders</title><h1>Orders</h1><ul><li>Order 42</li></ul>',
}

let server: Server
let base = ''
beforeAll(async () => {
  server = createServer((req, res) => {
    const page = PAGES[new URL(req.url ?? '/', 'http://x').pathname]
    res.writeHead(page ? 200 : 404, { 'content-type': 'text/html' })
    res.end(page ?? 'Not found')
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

/** A central repository beside the shop fixture, an Assay run started on it. */
async function run() {
  const dir = shop()
  const root = join(dirname(dir), 'architecture')
  mkdirSync(root)
  execFileSync('git', ['init', '-q'], { cwd: root })
  const model = await FolderModel.open(join(root, '.radical', 'model'))
  const call = async (name: string, input: unknown = {}) => model.call(name, input)
  await call('assay_start', { directories: ['../shop'] })
  const nodes = async () => JSON.parse((await call('search_model', { query: 'LIST NODES' })).text).rows as Array<{ id: string; type: string; label: string } & Record<string, unknown>>
  const relations = async () => JSON.parse((await call('search_model', { query: 'LIST RELATIONS' })).text).rows as Array<{ sourceId: string; targetId: string; relationType: string } & Record<string, unknown>>
  const ref = (text: string, role: string, name: string) => new RegExp(`(e\\d+) ${role} "${name}"`).exec(text)?.[1]
  return { dir, root, call, nodes, relations, ref, close: () => call('assay_start', { directories: ['../shop'] }) }
}

/** Signs in along a path named Sign in: opens the shop, fills both fields, clicks Sign in. */
async function signIn(r: Awaited<ReturnType<typeof run>>) {
  const opened = (await r.call('assay_explore', { url: `${base}/`, path: 'Sign in', repository: 'storefront' })).text
  const email = await r.call('assay_explore_act', { action: 'fill', ref: r.ref(opened, 'textbox', 'Email'), value: 'ada@example.com' })
  const password = await r.call('assay_explore_act', { action: 'fill', ref: r.ref(email.text, 'textbox', 'Password'), value: 'secret-1' })
  const signedIn = await r.call('assay_explore_act', { action: 'click', ref: r.ref(password.text, 'button', 'Sign in') })
  return { opened, signedIn }
}

const C4 = {
  elements: [
    { key: 'shop', type: 'system', label: 'Shop', facts: ['storefront:unit:apps/web'], confidence: 'inferred' },
    { key: 'web', type: 'webapp', label: 'Storefront', parent: 'shop', units: ['storefront:unit:apps/web'], facts: [], confidence: 'observed' },
  ],
}

describe('Radical Assay: the running application', () => {
  afterAll(() => { server.closeAllConnections(); server.close() })

  it('opens an application running on this machine, and refuses one on another host', async () => {
    const r = await run()
    const opened = await r.call('assay_explore', { url: `${base}/`, path: 'Look around', repository: 'storefront' })
    expect(opened.ok).toBe(true)
    expect(opened.text).toContain(`Screen explore:screen:1: ${base}/ "Shop"`)
    expect(opened.text).toContain('Headings: Shop')
    expect(opened.text).toMatch(/e\d+ textbox "Email"/)
    expect(opened.text).toMatch(/e\d+ button "Sign in"/)
    expect(opened.text).toContain('Screenshot: .radical/assay/explore/screens/001.png')
    expect(existsSync(join(r.root, '.radical/assay/explore/screens/001.png'))).toBe(true)
    expect(readFileSync(join(r.root, '.radical/assay/explore/.gitignore'), 'utf8')).toContain('*')
    const away = await r.call('assay_explore', { url: 'https://example.com/', path: 'Away', repository: 'storefront' })
    expect(away.ok).toBe(false)
    expect(away.text).toMatch(/^assay_explore: https:\/\/example\.com\/ is not on this machine/)
    expect((await r.call('assay_explore', { url: `${base}/`, path: 'Look around', repository: 'nowhere' })).ok).toBe(false)
    await r.close()
  }, 60_000)

  it('records each action as the next step of the path, a password not kept', async () => {
    const r = await run()
    const { signedIn } = await signIn(r)
    expect(signedIn.text).toContain('Headings: Welcome')
    expect(signedIn.text).toContain('"Sign in": 4 steps.')
    const paths = JSON.parse((await r.call('assay_facts', { repository: 'explore', kind: 'paths' })).text).facts
    expect(paths[0].steps.map((s: { action: string; control?: { role: string; name: string; locator: string }; value?: string; secret?: boolean }) => [s.action, s.control?.name, s.value, s.secret])).toEqual([
      ['goto', undefined, undefined, undefined],
      ['fill', 'Email', 'ada@example.com', undefined],
      ['fill', 'Password', undefined, true],
      ['click', 'Sign in', undefined, undefined],
    ])
    expect(paths[0].steps[3].control.locator).toBe('getByRole("button", { name: "Sign in", exact: true })')
    expect(JSON.stringify(paths)).not.toContain('secret-1')
    // Filling a field changes nothing a user sees: one screen before signing in, one after.
    expect(paths[0].steps.map((s: { to: string }) => s.to)).toEqual(['explore:screen:1', 'explore:screen:1', 'explore:screen:1', 'explore:screen:2'])
    const screens = JSON.parse((await r.call('assay_facts', { repository: 'explore', kind: 'screens' })).text).facts
    // The repository that builds the application has its paths too.
    expect(JSON.parse((await r.call('assay_facts', { repository: 'storefront', kind: 'paths' })).text).facts.map((x: { id: string }) => x.id)).toEqual(['explore:path:sign-in'])
    expect(JSON.stringify(screens)).not.toContain('secret-1')
    expect(screens[1]).toMatchObject({ route: '/home?email=ada%40example.com&password=***', text: expect.stringContaining('Welcome') })
    await r.close()
  }, 60_000)

  it('refuses a control that pays or deletes an account, and a link to another host', async () => {
    const r = await run()
    const opened = (await r.call('assay_explore', { url: `${base}/`, path: 'Try everything', repository: 'storefront' })).text
    const pay = await r.call('assay_explore_act', { action: 'click', ref: r.ref(opened, 'button', 'Pay now') })
    expect(pay).toEqual({ ok: false, text: 'assay_explore_act: button "Pay now" looks like it moves money or ends an account: Assay does not act on it, even on a test database. Tell the user.' })
    expect((await r.call('assay_explore_act', { action: 'click', ref: r.ref(opened, 'button', 'Delete account') })).ok).toBe(false)
    const away = await r.call('assay_explore_act', { action: 'click', ref: r.ref(opened, 'link', 'Elsewhere') })
    expect(away.text).toBe('assay_explore_act: link "Elsewhere" leads to https://example.com/, not the application\'s (' + new URL(base).host + '): Assay stays on it')
    expect((await r.call('assay_explore_act', { action: 'goto', value: 'https://example.com/x' })).ok).toBe(false)
    const paths = JSON.parse((await r.call('assay_facts', { repository: 'explore', kind: 'paths' })).text).facts
    expect(paths[0].steps).toHaveLength(1)
    await r.close()
  }, 60_000)

  it('writes screens as observed mockups, joined in the order of the path', async () => {
    const r = await run()
    await signIn(r)
    await r.call('assay_apply', { plan: C4 })
    const applied = await r.call('assay_apply', { plan: { mockups: [
      { key: 'm-start', label: 'Sign-in page', screen: 'explore:screen:1', presentedBy: 'web', parent: 'shop' },
      { key: 'm-home', label: 'Home', screen: 'explore:screen:2', presentedBy: 'web', parent: 'shop', description: 'What a customer sees after signing in.' },
    ] } })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('Wrote 0 elements, 2 mockups and 3 relations')
    const all = await r.nodes()
    const start = all.find((n) => n.label === 'Sign-in page')!
    const home = all.find((n) => n.label === 'Home')!
    expect(start).toMatchObject({ type: 'mockup', screen: '/' })
    // A mockup is the page: what the form put in the address is no part of it.
    expect(home).toMatchObject({ type: 'mockup', screen: '/home' })
    const rel = await r.relations()
    const web = all.find((n) => n.label === 'Storefront')!.id
    expect(rel).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: start.id, targetId: web, relationType: 'presented-by' }),
      expect.objectContaining({ sourceId: start.id, targetId: home.id, relationType: 'navigates-to', description: 'clicks button "Sign in"' }),
    ]))
    const evidence = JSON.parse(readFileSync(join(r.root, '.radical/assay/run.json'), 'utf8')).written.find((w: { id: string }) => w.id === start.id)
    expect(evidence).toMatchObject({ kind: 'mockup', confidence: 'observed', evidence: [{ fact: 'explore:screen:1', repository: 'explore', file: 'screens/001.png' }] })
    expect((await r.call('assay_apply', { plan: { mockups: [{ key: 'x', label: 'X', screen: 'storefront:unit:apps/web' }] } })).text).toContain('screen must name a screen of the explored application')
    await r.close()
  }, 60_000)

  it('writes an accepted path as a Playwright test of the repository, which passes', async () => {
    const r = await run()
    await signIn(r)
    // The outcome the scenario names, checked on the screen and kept as a step; a text not there, or a password, is refused.
    expect((await r.call('assay_explore_act', { action: 'expect', value: 'Order 99' })).text).toBe('assay_explore_act: "Order 99" is not on the current screen (explore:screen:2): expect a text it shows')
    expect((await r.call('assay_explore_act', { action: 'expect', value: 'secret-1' })).text).toBe('assay_explore_act: expect names a password typed in this path: Assay keeps none')
    expect((await r.call('assay_explore_act', { action: 'expect', value: 'Welcome' })).ok).toBe(true)
    await r.call('assay_apply', { plan: C4 })
    await r.call('assay_apply', { plan: { requirements: [{
      key: 'r-sign-in', label: 'Sign in', satisfiedBy: 'web',
      properties: { ears_type: 'event-driven', trigger: 'a customer signs in with their email and password', action: 'the storefront shall welcome them' },
      scenarios: [{ key: 's-sign-in', label: 'Customer signs in', given: 'the sign-in page', when: 'the customer gives their email and password', then: 'the storefront welcomes them', paths: ['explore:path:sign-in'] }],
    }] } })
    const accepted = await r.call('assay_answer', { proposal: 'P1', accept: true })
    expect(accepted.text).toContain('storefront/e2e/assay/sign-in.spec.ts')
    const spec = readFileSync(join(r.dir, 'storefront', 'e2e/assay/sign-in.spec.ts'), 'utf8')
    expect(spec).toContain('await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com")')
    expect(spec).toContain('.fill(PASSWORD)')
    expect(spec).toContain("expect(PASSWORD, 'Set E2E_PASSWORD to the password of the test account').not.toBe('')")
    expect(readFileSync(join(r.dir, 'storefront', 'e2e/assay/playwright.config.ts'), 'utf8')).toContain("testDir: '.'")
    expect(spec).toContain("await expect(page.getByRole('heading', { name: \"Welcome\", exact: true }).first()).toBeVisible()")
    expect(spec).toContain('await expect(page.getByText("Welcome").first()).toBeVisible()')
    expect(spec).not.toContain('secret-1')
    const mapping = JSON.parse(readFileSync(join(r.dir, 'storefront', '.radical/radical.json'), 'utf8'))
    const scenario = (await r.nodes()).find((n) => n.label === 'Customer signs in')!
    expect(mapping.verifies).toContainEqual(expect.objectContaining({ element: scenario.id, tests: ['e2e/assay/sign-in.spec.ts › Sign in'] }))
    await r.close()

    // The test replays the path against the application, as the repository's CI would.
    const here = dirname(fileURLToPath(import.meta.url))
    const work = mkdtempSync(join(here, '..', '.explore-test-'))
    try {
      writeFileSync(join(work, 'sign-in.spec.ts'), spec)
      writeFileSync(join(work, 'playwright.config.mjs'), "export default { testDir: '.', outputDir: './results', reporter: 'line', use: { headless: true } }\n")
      // Not spawnSync: the application is served by this very process.
      const result = await new Promise<{ status: number | null; out: string }>((done) => {
        const child = spawn(join(here, '..', '..', '..', 'node_modules', '.bin', 'playwright'), ['test', '--config', join(work, 'playwright.config.mjs')], {
          cwd: work, env: { ...process.env, E2E_BASE_URL: base, E2E_PASSWORD: 'secret-1' },
        })
        let out = ''
        child.stdout.on('data', (d) => { out += d })
        child.stderr.on('data', (d) => { out += d })
        child.on('close', (status) => done({ status, out }))
      })
      expect(result.status, result.out).toBe(0)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  }, 120_000)
})
