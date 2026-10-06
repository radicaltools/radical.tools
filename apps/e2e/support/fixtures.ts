import { test as base, expect, type Browser, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { layoutViolations, type Box } from './geometry'

/** Id of the seeded localStorage document (`radical-doc:<id>` in Studio). */
export const DOC_ID = 'e2e-doc'

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}.radical`, import.meta.url)), 'utf8')
}

type Mode = 'designer' | 'viewer' | 'presenter' | 'metamodel'

/** The slice of a saved `.radical` document the tests read back. */
export interface StoredDoc {
  nodes: { id: string; label: string; parentId?: string }[]
  relations: { id: string; sourceId: string; targetId: string }[]
  views?: { id: string; nodeIds: string[]; positions: Record<string, { x: number; y: number }> }[]
}

/** Studio driven through its real UI; state reads go through localStorage. */
export class Studio {
  private frozen = false

  constructor(readonly page: Page) {}

  /**
   * Stop the page clock (timers, requestAnimationFrame, Date) before the app
   * loads; time then moves only through `advance()`. Screenshot tests use
   * this so animations and the live layout render the same frame on every
   * run. Call before the first navigation. The page clock does not reach a
   * Web Worker, so the live layout runs on the page thread instead of its
   * worker; physics.spec.ts covers the worker on a real clock.
   */
  async freezeTime(): Promise<void> {
    await this.page.addInitScript(() => {
      (window as { __RADICAL_LIVE_LAYOUT?: string }).__RADICAL_LIVE_LAYOUT = 'thread'
    })
    await this.page.clock.install({ time: new Date('2026-01-01T09:00:00Z') })
    await this.page.clock.pauseAt(new Date('2026-01-01T09:00:01Z'))
    this.frozen = true
  }

  /** Move a frozen clock forward (no-op on a real clock). */
  async advance(ms: number): Promise<void> {
    if (this.frozen) await this.page.clock.runFor(ms)
  }

  /**
   * Wait for something that depends on the network (real time) and on the
   * app's timers (page clock). On a frozen clock this steps one frame at a
   * time, so whatever renders next starts from the same frame on every run.
   */
  async until(target: Locator, timeout = 15_000): Promise<void> {
    if (this.frozen) {
      const end = Date.now() + timeout
      while (!(await target.first().isVisible()) && Date.now() < end) {
        await this.advance(16)
        await this.page.waitForTimeout(10)
      }
    }
    await expect(target.first()).toBeVisible({ timeout })
  }

  get nodes(): Locator { return this.page.locator('.react-flow__node') }
  get edges(): Locator { return this.page.locator('.react-flow__edge') }
  get pane(): Locator { return this.page.locator('.react-flow__pane') }
  get canvas(): Locator { return this.page.locator('.canvas-area') }

  node(id: string): Locator { return this.page.getByTestId(`rf__node-${id}`) }

  /** A canvas node by its exact visible label. */
  nodeByLabel(label: string): Locator {
    return this.nodes.filter({ has: this.page.getByText(label, { exact: true }) })
  }

  /**
   * Seed a fixture as the active document before the app boots. Only on the
   * first load of the context, so a reload shows what the app saved.
   */
  async seed(name = 'bookstore'): Promise<void> {
    await this.seedDocument(fixture(name))
  }

  /** Seed raw `.radical` JSON (e.g. a document saved by another page). */
  async seedDocument(json: string): Promise<void> {
    await this.page.addInitScript(([id, data]) => {
      if (localStorage.getItem('radical-docs-index')) return
      localStorage.setItem('radical-docs-index', JSON.stringify({
        docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }],
        activeId: id,
      }))
      localStorage.setItem(`radical-doc:${id}`, data)
    }, [DOC_ID, json] as const)
  }

  /** Open a view of the seeded document through a deep link. */
  async open(view: string, mode: Mode = 'designer', docId = DOC_ID): Promise<void> {
    await this.page.goto(`/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
    await this.ready()
  }

  /** Open the bundled Fintech sample from the welcome screen, then `view`. */
  async openSample(view = 'view-ctx'): Promise<void> {
    await this.page.goto('/')
    await this.page.getByRole('button', { name: /Explore the sample/ }).click()
    await this.advance(1000)
    await expect(this.page).toHaveURL(/\/v\/view-ctx$/)
    await this.ready()
    if (view !== 'view-ctx') await this.open(view, 'designer', this.activeDocId())
  }

  /** The app has booted (no welcome splash, no crash) and the canvas is still. */
  async ready(): Promise<void> {
    await expect(this.page.locator('.app-layout')).toBeVisible()
    await this.settle()
    await expect(this.page.getByText('Runtime Error')).toHaveCount(0)
  }

  /**
   * Wait until the canvas camera stops moving (auto-fit and view switches
   * animate the viewport in JS, which `animations: 'disabled'` cannot stop).
   */
  async settle(): Promise<void> {
    if (this.frozen) {
      await this.advance(3000)
      await this.page.evaluate(() => document.fonts.ready)
      return
    }
    if (!(await this.canvas.count())) return
    const viewport = this.page.locator('.react-flow__viewport')
    let prev = ''
    let stable = 0
    for (let i = 0; i < 60 && stable < 3; i++) {
      const cur = await viewport.getAttribute('style') ?? ''
      stable = cur === prev ? stable + 1 : 0
      prev = cur
      await this.page.waitForTimeout(100)
    }
    await this.page.evaluate(() => document.fonts.ready)
  }

  async smartLayout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
    // Done when the ranking report appears, or when Smart Layout says it
    // kept the current layout (or found nothing), which has no report.
    const done = this.page.getByTitle(/^Why this layout\?/).or(this.page.getByText(/^Smart layout: /))
    if (this.frozen) {
      for (let i = 0; i < 400 && !(await done.first().isVisible()); i++) await this.advance(100)
    }
    await expect(done.first()).toBeVisible({ timeout: 30_000 })
    await this.settle()
  }

  /** Every rendered node's canvas position and size, by node id. */
  async positions(): Promise<Record<string, string>> {
    return this.nodes.evaluateAll((els) => Object.fromEntries(els.map((el) => {
      const e = el as HTMLElement
      return [e.dataset.id!, `${e.style.transform} ${e.offsetWidth}x${e.offsetHeight}`]
    })))
  }

  /** Alt-drag from one node to another: Studio's connect gesture. */
  async connect(from: Locator, to: Locator): Promise<void> {
    await this.settle() // a moving camera would drop the gesture off target
    const a = (await from.boundingBox())!
    const b = (await to.boundingBox())!
    await this.page.keyboard.down('Alt')
    await this.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
    await this.page.mouse.up()
    await this.page.keyboard.up('Alt')
  }

  /** Drag an element type from the Elements palette onto the canvas. */
  async addFromPalette(typeLabel: string, at: { x: number; y: number }): Promise<void> {
    await this.page.locator('.palette-item', { hasText: typeLabel }).first()
      .dragTo(this.pane, { targetPosition: at })
  }

  /** The document as the app last saved it to localStorage (raw JSON). */
  async storedJson(docId = DOC_ID): Promise<string> {
    const json = await this.page.evaluate((key) => localStorage.getItem(key), `radical-doc:${docId}`)
    if (!json) throw new Error(`no saved document ${docId}`)
    return json
  }

  /** The document as the app last saved it to localStorage. */
  async storedDoc(docId = DOC_ID): Promise<StoredDoc> {
    return JSON.parse(await this.storedJson(docId))
  }

  /** Every rendered node's screen box, by node id. */
  async boxes(): Promise<Record<string, Box>> {
    return this.nodes.evaluateAll((els) => Object.fromEntries(els.map((el) => {
      const r = el.getBoundingClientRect()
      return [(el as HTMLElement).dataset.id!, { x: r.x, y: r.y, width: r.width, height: r.height }]
    })))
  }

  /** Overlapping siblings and escaped children on the current canvas. */
  async layoutViolations(docId = DOC_ID): Promise<string[]> {
    const doc = await this.storedDoc(docId)
    const parentOf = Object.fromEntries(doc.nodes.map((n) => [n.id, n.parentId]))
    return layoutViolations(await this.boxes(), parentOf)
  }

  /** Id of the active document (the sample gets a fresh uuid per context). */
  activeDocId(): string {
    const m = this.page.url().match(/#\/d\/([^/]+)/)
    return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : DOC_ID
  }
}

/** Console messages that are expected and harmless. Keep this list short. */
const ALLOWED_CONSOLE_ERRORS: RegExp[] = [
  // External requests are blocked on purpose (see below).
  /net::ERR_FAILED/,
]

/**
 * Block requests beyond the app itself (tests stay hermetic and web fonts
 * cannot change a screenshot) and collect uncaught exceptions and console
 * errors, which is often where a regression shows up first.
 */
async function guard(page: Page): Promise<string[]> {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !ALLOWED_CONSOLE_ERRORS.some((re) => re.test(m.text()))) {
      problems.push(`console.error: ${m.text()}`)
    }
  })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort())
  return problems
}

/**
 * A Studio in its own browser context (own localStorage), set up like the
 * `studio` fixture. Check `problems` before `close()`.
 */
export async function isolatedStudio(browser: Browser): Promise<{ studio: Studio; problems: string[]; close: () => Promise<void> }> {
  const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent } = base.info().project.use
  const context = await browser.newContext({ viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent })
  const page = await context.newPage()
  const problems = await guard(page)
  return { studio: new Studio(page), problems, close: () => context.close() }
}

export const test = base.extend<{ studio: Studio; guard: void }>({
  guard: [async ({ page }, use, testInfo) => {
    const problems = await guard(page)
    await use()
    if (testInfo.status === testInfo.expectedStatus) {
      expect(problems, 'uncaught errors / console errors during the test').toEqual([])
    }
  }, { auto: true }],

  studio: async ({ page }, use) => {
    await use(new Studio(page))
  },
})

export { expect }
