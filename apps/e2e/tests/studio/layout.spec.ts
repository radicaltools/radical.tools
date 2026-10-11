import type { Browser } from '@playwright/test'
import { test, expect, isolatedStudio, type Studio } from '../../support/fixtures'

// Smart Layout on real renders. Unit tests in packages/layout score the
// algorithms; these check that what reaches the screen holds the basic
// invariants (no overlapping siblings, children inside their parent) and
// still looks the same.
//
// Smart Layout saves its result as soon as it is applied. Each test runs the
// layout in a separate context, then reopens that saved document here on a
// frozen clock, so the screenshot shows exactly the layout result: the live
// layout that keeps nudging nested views (see known-issues.spec.ts) has no
// frames in which to move it.

async function smartLayoutResult(browser: Browser, prepare: (s: Studio) => Promise<void>): Promise<string> {
  const { studio, problems, close } = await isolatedStudio(browser)
  try {
    await studio.freezeTime()
    await prepare(studio)
    await studio.smartLayout()
    const json = await studio.storedJson(studio.activeDocId())
    expect(problems).toEqual([])
    return json
  } finally {
    await close()
  }
}

test.beforeEach(async ({ studio }) => {
  await studio.freezeTime()
})

test('bookstore containers', async ({ browser, page, studio }) => {
  const saved = await smartLayoutResult(browser, async (s) => {
    await s.seed()
    await s.open('v-containers')
  })
  await studio.seedDocument(saved)
  await studio.open('v-containers')
  await expect(studio.nodes).toHaveCount(6)
  expect(await studio.layoutViolations()).toEqual([])
  await expect(page).toHaveScreenshot('smart-layout-bookstore-containers.png')
})

for (const view of ['view-ctx', 'view-core', 'view-payments', 'view-screens', 'view-trace', 'canvas']) {
  test(`sample ${view}`, async ({ browser, page, studio }) => {
    // Smart Layout of the sample in a second context plus a reopen on a
    // frozen clock: 'canvas' took ~40 s of the 60 s budget on CI runners
    // before the sample grew, so give these the slow-test timeout.
    test.slow()
    const saved = await smartLayoutResult(browser, (s) => s.openSample(view))
    await studio.seedDocument(saved)
    await studio.open(view)
    expect(await studio.layoutViolations()).toEqual([])
    await expect(page).toHaveScreenshot(`smart-layout-sample-${view}.png`)
  })
}

test('the result is the same on every run', async ({ browser }) => {
  const prepare = async (s: Studio): Promise<void> => {
    await s.seed()
    await s.open('v-containers')
  }
  // Node geometry only: the saved camera depends on where an animation was.
  const geometry = (json: string): unknown => {
    const doc = JSON.parse(json)
    return { nodes: doc.nodes, views: doc.views.map((v: { id: string; positions: unknown }) => [v.id, v.positions]) }
  }
  const first = geometry(await smartLayoutResult(browser, prepare))
  const second = geometry(await smartLayoutResult(browser, prepare))
  expect(second).toEqual(first)
})

test('Undo puts every node back where it was before Smart Layout', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const positions = () => studio.nodes.evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec((el as HTMLElement).style.transform)
    return [(el as HTMLElement).dataset.id, [Number(m?.[1]), Number(m?.[2])]]
  })))
  // The live layout keeps nudging nodes while Smart Layout runs (longer on a
  // slow runner), so Undo lands near, not exactly on, the starting positions:
  // compare with how far the layout moved them.
  const furthest = (a: Record<string, number[]>, b: Record<string, number[]>) =>
    Math.max(...Object.keys(a).map((id) => Math.hypot(a[id][0] - b[id][0], a[id][1] - b[id][1])))
  const before = await positions()
  await studio.smartLayout()
  await studio.advance(500)
  const moved = furthest(before, await positions())
  expect(moved).toBeGreaterThan(100)
  // The toolbar button sits under Quick Search at this width (known-issues.spec.ts).
  await studio.pane.click()
  await page.keyboard.press('ControlOrMeta+z')
  await studio.advance(500)
  expect(furthest(before, await positions())).toBeLessThan(moved / 5)
})
