// ─── Radical Assay: the Explore stage's browser ──────────────────────────────
// ADR Assay explores the running application. The server, not the agent,
// drives the browser: it opens a web application running on this machine
// with Playwright (the user's Chrome, else Playwright's Chromium), reads each
// screen (its address, title, headings and the controls it can act on, each
// with a reference, its role and its name), keeps its screenshot, and records
// each action of the agent as the next step of a named path. It stays on the
// application's host and leaves alone a control whose name says it pays or
// deletes an account: the user runs the application on a test database, so
// everything else may be clicked.

import { mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core'
import type { Control, PathFact, RepositoryFacts, ScreenFact, Step } from '@radical/assay'

/** A host of this machine: the only ones explored. */
export function localHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(host) || host === '::1' || host === '0.0.0.0'
}

/** A control whose name says it moves money or ends an account: never acted on. */
const DESTRUCTIVE = /\b(pay|payment|pay now|purchase|buy( now)?|transfer( money| funds)?|wire|send money|(delete|close|deactivate|remove|terminate) (my |your |the |this )?account)\b/i

/** At most this many controls of a screen are listed; at most this many screens a run keeps. */
const MAX_CONTROLS = 150
const MAX_SCREENS = 300
const ACTION_TIMEOUT = 10_000

export type ExploreAction = Step['action']

/** What a call of the Explore stage gives back: the screen reached, or why nothing was done. */
export type Explored = { screen: ScreenFact; path: PathFact } | { problem: string }

/** Reads the controls, headings and title of the page in the browser, and tags each control with
 *  its reference (data-assay-ref) so an action finds it. Plain JavaScript, sent to the page as it
 *  is: a function compiled here would carry the bundler's helpers, which the page does not have. */
const READ_PAGE = String.raw`(max) => {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const text = (t) => (t || '').replace(/\s+/g, ' ').trim()
  const roleOf = (el) => {
    const given = el.getAttribute('role')
    if (given) return given
    const tag = el.tagName
    if (tag === 'A') return el.hasAttribute('href') ? 'link' : null
    if (tag === 'BUTTON') return 'button'
    if (tag === 'SELECT') return 'combobox'
    if (tag === 'TEXTAREA') return 'textbox'
    if (tag === 'INPUT') {
      const roles = { checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', reset: 'button', image: 'button', search: 'searchbox', range: 'slider', number: 'spinbutton' }
      return roles[el.type] || 'textbox'
    }
    return null
  }
  const nameOf = (el) => {
    const label = el.getAttribute('aria-label')
    if (label) return text(label)
    const by = el.getAttribute('aria-labelledby')
    if (by) return text(by.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent).join(' '))
    if (el.labels && el.labels.length) return text(Array.from(el.labels).map((l) => l.textContent).join(' '))
    if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type)) return text(el.value)
    const inner = text(el.innerText)
    if (inner) return inner.slice(0, 80)
    const img = el.querySelector('img')
    return text(el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || (img && img.alt))
  }
  for (const old of document.querySelectorAll('[data-assay-ref]')) old.removeAttribute('data-assay-ref')
  const selector = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=switch], [role=combobox], [role=textbox], [role=option]'
  const controls = []
  for (const el of document.querySelectorAll(selector)) {
    if (controls.length >= max) break
    if (!visible(el) || el.disabled) continue
    const role = roleOf(el)
    if (!role) continue
    const ref = 'e' + (controls.length + 1)
    el.setAttribute('data-assay-ref', ref)
    controls.push({ ref, role, name: nameOf(el) })
  }
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role=heading]')).filter(visible).map((h) => text(h.textContent)).filter(Boolean).slice(0, 20)
  const words = text(document.body ? document.body.innerText : '').slice(0, 600)
  return { title: document.title, headings, controls, text: words }
}`

export class Explorer {
  private browser?: Browser
  private context?: BrowserContext
  private page?: Page
  /** The current screen's controls, by reference. */
  private controls = new Map<string, Control>()
  private screen?: ScreenFact
  private path?: PathFact
  /** What was typed into password fields: never kept, and cut out of the addresses recorded. */
  private readonly secrets = new Set<string>()

  /** `facts`: the run's Explore session, whose screens and paths it records; `dir`: where it keeps the screenshots;
   *  `root`: the central repository, the screenshots' paths are from. */
  constructor(private readonly facts: RepositoryFacts, private readonly dir: string, private readonly root: string, private readonly options: { browser?: string } = {}) {}

  /** The browser, launched once: the user's Chrome, else Playwright's Chromium. */
  private async launch(): Promise<Page | string> {
    if (this.browser?.isConnected()) return this.fresh()
    const { chromium } = await import('playwright-core')
    const tried: string[] = []
    for (const channel of this.options.browser ? [this.options.browser] : ['chrome', 'chromium']) {
      try {
        this.browser = await chromium.launch({ headless: true, ...(channel === 'chromium' ? {} : { channel }) })
        break
      } catch (error) {
        tried.push(`${channel}: ${(error as Error).message.split('\n')[0]}`)
      }
    }
    if (!this.browser) return `no browser to explore with (${tried.join('; ')}): install Google Chrome, or run npx playwright install chromium`
    return this.fresh()
  }

  /** A fresh session for a new path, signed out, as the path's test will start. */
  private async fresh(): Promise<Page> {
    await this.context?.close().catch(() => {})
    this.context = await this.browser!.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await this.context.newPage()
    this.page = page
    // A page the application opens beside it is not followed.
    this.context.on('page', (opened) => { if (opened !== page) void opened.close() })
    return page
  }

  /** The address as recorded: a value typed into a password field, or a parameter named like a secret, cut out. */
  private recorded(url: URL): URL {
    const out = new URL(url.href)
    for (const [key, value] of url.searchParams) {
      if (this.secrets.has(value) || /pass|pwd|secret|token|api[-_]?key/i.test(key)) out.searchParams.set(key, '***')
    }
    return out
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {})
    this.browser = undefined
    this.page = undefined
  }

  /** Reads the screen the page shows now, keeps its screenshot, and makes it a fact. */
  private async read(page: Page): Promise<ScreenFact> {
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {})
    const seen = await page.evaluate(`(${READ_PAGE})(${MAX_CONTROLS})`) as { title: string; headings: string[]; controls: Array<{ ref: string; role: string; name: string }>; text: string }
    const url = this.recorded(new URL(page.url()))
    this.controls = new Map(seen.controls.map((c) => [c.ref, c]))
    // An action that changed nothing a user sees (a field filled) leaves the screen as it was.
    const same = (a: ScreenFact) => a.url === url.href && a.title === seen.title && JSON.stringify(a.headings) === JSON.stringify(seen.headings)
      && JSON.stringify(a.controls.map((c) => [c.role, c.name])) === JSON.stringify(seen.controls.map((c) => [c.role, c.name]))
    if (this.screen && same(this.screen)) {
      this.screen = { ...this.screen, controls: seen.controls }
      const at = this.facts.screens.findIndex((x) => x.id === this.screen!.id)
      if (at >= 0) this.facts.screens[at] = this.screen
      return this.screen
    }
    const n = this.facts.screens.length + 1
    const file = join(this.dir, 'screens', `${String(n).padStart(3, '0')}.png`)
    mkdirSync(join(this.dir, 'screens'), { recursive: true })
    await page.screenshot({ path: file }).catch(() => {})
    const screen: ScreenFact = {
      id: `${this.facts.repository}:screen:${n}`,
      url: url.href,
      route: `${url.pathname}${url.search}${url.hash}`,
      title: seen.title,
      headings: seen.headings,
      ...(seen.text ? { text: seen.text } : {}),
      controls: seen.controls,
      evidence: { file: relative(this.dir, file).split('\\').join('/'), line: 1 },
    }
    this.facts.screens.push(screen)
    this.screen = screen
    return screen
  }

  /** How Playwright finds the control `ref`: by its role and name when that names it alone, else by its
   *  test id or id, else the nth of its role and name; checked against the element itself. */
  private async locate(page: Page, control: Control): Promise<string> {
    const element = page.locator(`[data-assay-ref="${control.ref}"]`)
    const same = async (candidate: Locator): Promise<boolean> =>
      (await candidate.count().catch(() => 0)) === 1 && await candidate.getAttribute('data-assay-ref').catch(() => null) === control.ref
    const byRole = `getByRole(${JSON.stringify(control.role)}, { name: ${JSON.stringify(control.name)}, exact: true })`
    if (control.name && await same(page.getByRole(control.role as never, { name: control.name, exact: true }))) return byRole
    const ids = { testid: await element.getAttribute('data-testid').catch(() => null), id: await element.getAttribute('id').catch(() => null) }
    if (ids.testid && await same(page.getByTestId(ids.testid))) return `getByTestId(${JSON.stringify(ids.testid)})`
    if (ids.id && /^[A-Za-z][\w-]*$/.test(ids.id) && await same(page.locator(`#${ids.id}`))) return `locator(${JSON.stringify(`#${ids.id}`)})`
    if (control.name) {
      const all = page.getByRole(control.role as never, { name: control.name, exact: true })
      const count = await all.count().catch(() => 0)
      for (let i = 0; i < count; i++) if (await same(all.nth(i))) return `${byRole}.nth(${i})`
    }
    return `locator(${JSON.stringify(`[data-assay-ref="${control.ref}"]`)})`
  }

  /** Opens `url` (an application on this machine) and starts the path `name` there. */
  async open(url: string, name: string, repository: string): Promise<Explored> {
    let target: URL
    try { target = new URL(url) } catch { return { problem: `${url} is no address` } }
    if (!/^https?:$/.test(target.protocol)) return { problem: `${url} is no http(s) address` }
    if (!localHost(target.hostname)) return { problem: `${url} is not on this machine: Assay explores an application running locally (localhost, a loopback address or a .localhost name), on a test database` }
    if (this.facts.paths.some((p) => p.name === name)) return { problem: `a path is named "${name}" already: name this one apart` }
    if (this.facts.screens.length >= MAX_SCREENS) return { problem: `the run keeps at most ${MAX_SCREENS} screens` }
    const page = await this.launch()
    if (typeof page === 'string') return { problem: page }
    this.screen = undefined
    try {
      await page.goto(target.href, { timeout: 30_000 })
    } catch (error) {
      return { problem: `${url} does not open: ${(error as Error).message.split('\n')[0]}` }
    }
    const screen = await this.read(page)
    const path: PathFact = {
      id: `${this.facts.repository}:path:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || this.facts.paths.length + 1}`,
      name,
      origin: target.origin,
      repository,
      steps: [{ action: 'goto', to: screen.id }],
      evidence: screen.evidence,
    }
    if (this.facts.paths.some((p) => p.id === path.id)) path.id = `${path.id}-${this.facts.paths.length + 1}`
    this.facts.paths.push(path)
    this.path = path
    return { screen, path }
  }

  /** Performs `action` on the control `ref` of the current screen (or goes to `value`, an address of
   *  the application), and records it as the next step of the current path. */
  async act(action: ExploreAction, ref: string | undefined, value: string | undefined): Promise<Explored> {
    const page = this.page
    const path = this.path
    const from = this.screen
    if (!page || page.isClosed() || !path || !from) return { problem: 'no application is open: start a path with assay_explore' }
    if (this.facts.screens.length >= MAX_SCREENS) return { problem: `the run keeps at most ${MAX_SCREENS} screens` }
    const origin = new URL(path.origin)
    let step: Step
    if (action === 'goto') {
      let target: URL
      try { target = new URL(value ?? '', origin) } catch { return { problem: `${value} is no address` } }
      if (target.host !== origin.host) return { problem: `${target.href} is not the application's (${origin.host}): Assay stays on it` }
      try {
        await page.goto(target.href, { timeout: 30_000 })
      } catch (error) {
        return { problem: `${target.href} does not open: ${(error as Error).message.split('\n')[0]}` }
      }
      const screen = await this.read(page)
      step = { action, from: from.id, to: screen.id }
      path.steps.push(step)
      return { screen, path }
    }
    const control = ref ? this.controls.get(ref) : undefined
    if (!control) return { problem: `${ref ?? 'no reference'} is no control of the current screen (${from.id}): name one of its references` }
    if (DESTRUCTIVE.test(control.name)) return { problem: `${control.role} "${control.name}" looks like it moves money or ends an account: Assay does not act on it, even on a test database. Tell the user.` }
    if (['fill', 'select', 'press'].includes(action) && value === undefined) return { problem: `${action} needs a value` }
    const element = page.locator(`[data-assay-ref="${control.ref}"]`)
    if (control.role === 'link') {
      const given = await element.getAttribute('href').catch(() => null)
      const href = given ? new URL(given, page.url()).href : ''
      if (href && /^https?:/.test(href) && new URL(href).host !== origin.host) return { problem: `link "${control.name}" leads to ${href}, not the application's (${origin.host}): Assay stays on it` }
    }
    const locator = await this.locate(page, control)
    const secret = action === 'fill' && (await element.getAttribute('type').catch(() => null))?.toLowerCase() === 'password'
    if (secret && value) this.secrets.add(value)
    try {
      if (action === 'click') await element.click({ timeout: ACTION_TIMEOUT })
      else if (action === 'fill') await element.fill(value!, { timeout: ACTION_TIMEOUT })
      else if (action === 'select') await element.selectOption(value!, { timeout: ACTION_TIMEOUT })
      else if (action === 'check') await element.check({ timeout: ACTION_TIMEOUT })
      else await element.press(value!, { timeout: ACTION_TIMEOUT })
    } catch (error) {
      return { problem: `${action} on ${control.role} "${control.name}" failed: ${(error as Error).message.split('\n')[0]}` }
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const now = new URL(page.url())
    if (now.host !== origin.host) {
      await page.goBack().catch(() => {})
      await this.read(page)
      return { problem: `${action} on ${control.role} "${control.name}" led to ${now.href}, not the application's: went back, no step kept` }
    }
    const screen = await this.read(page)
    step = {
      action,
      control: { role: control.role, name: control.name, locator },
      ...(value !== undefined ? (secret ? { secret: true } : { value }) : {}),
      from: from.id,
      to: screen.id,
    }
    path.steps.push(step)
    return { screen, path }
  }

  /** The screen as the agent reads it: its address, headings and controls, and the path so far. */
  static describe(screen: ScreenFact, path: PathFact, root: string, dir: string): string {
    return [
      `Screen ${screen.id}: ${screen.url}${screen.title ? ` "${screen.title}"` : ''}`,
      ...(screen.headings.length ? [`Headings: ${screen.headings.join(' · ')}`] : []),
      ...(screen.text ? [`Text: ${screen.text.length >= 600 ? `${screen.text}…` : screen.text}`] : []),
      `Controls (${screen.controls.length}${screen.controls.length >= MAX_CONTROLS ? ', the first' : ''}):`,
      ...screen.controls.map((c) => `  ${c.ref} ${c.role} "${c.name}"`),
      `Screenshot: ${relative(root, join(dir, screen.evidence.file)).split('\\').join('/')}`,
      `Path ${path.id} "${path.name}": ${path.steps.length} step${path.steps.length === 1 ? '' : 's'}.`,
    ].join('\n')
  }
}
