import type { FitnessSpec, PackSpec } from '../../src/packSpec'

const FORCES = 'This element is a web front end that people open on their own phones and computers, over networks they do not choose. The forces: most visits come from mid-range phones on mobile networks, where every image and script costs seconds that a developer\'s laptop never shows; what users feel is how soon the main content appears (LCP), how soon a tap answers (INP) and whether the page jumps while it loads (CLS), and Google measures exactly these at the 75th percentile of real visits; lab runs on every change are repeatable but simulate one phone on one network, field data is the truth but arrives days later and only once the page is live; lab timings depend on the CPU of the machine that runs them; people zoom, use small screens and hit targets with a thumb, so a layout that scrolls sideways at 320 CSS px or a 16 px icon button fails some of them (WCAG 2.2: Reflow, Target Size); and a layout that breaks on a phone is seldom seen by a team that works on desktops.'

const LAB_SNIPPET = `// lighthouserc.cjs: Lighthouse CI only collects; the model's conditions judge the numbers
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: ['http://localhost:4173/', 'http://localhost:4173/search', 'http://localhost:4173/checkout'],
      numberOfRuns: 3,
      // puppeteerScript: './lighthouse-login.cjs',   // signs in first, for pages behind sign-in
    },
  },
}
// The pull-request job (no assert, no upload: radical check fails the job):
//   npx @lhci/cli@0.15.1 collect                                        # phones: Lighthouse's mobile default
//   npx @lhci/cli@0.15.1 collect --additive --settings.preset=desktop   # desktops; without --additive when only desktops count
//   npx radical sense run --trigger pull-request --out reports/metrics  # lighthouse reads .lighthouseci, machine times the runner
//   npx radical check --metrics reports/metrics`

/** The lab budget for one device class: fixed limits, or no regression against main. */
function lab(device: 'mobile' | 'desktop', profile: 'budget' | 'baseline'): FitnessSpec {
  const devices = device === 'mobile' ? ['mobile', 'both'] : ['both', 'desktop']
  const preset = device === 'mobile' ? 'Lighthouse\'s mobile default (a mid-range phone on a slow 4G connection, simulated)' : 'Lighthouse\'s desktop preset'
  const common = {
    characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: ['adr-perf-budget'] as string[], tool: 'Lighthouse CI (@lhci/cli) with radical sense lighthouse', language: 'js', snippet: LAB_SNIPPET,
  } as const
  if (profile === 'budget') {
    return {
      ...common,
      id: `ff-lab-${device}`, label: `Lab budget on ${device === 'mobile' ? 'phones' : 'desktops'}`, when: { DEVICES: devices, LAB: ['budget'] }, checks: ['req-lab-budget'],
      threshold: `For the slowest main page, median of three runs with ${preset}: LCP within {{LCP_MS}} ms, CLS at most {{CLS}}, and Total Blocking Time within {{TBT_MS}} ms on the reference machine, that limit scaled to the speed of the runner`,
      measure: 'lighthouse\nmachine',
      metrics: `web.lab.lcp.max{device=${device}} <= {{LCP_MS}} ms
web.lab.cls.max{device=${device}} <= {{CLS}}
web.lab.tbt.max{device=${device}} <= {{TBT_MS}} ms scaled`,
      description: `On every pull request Lighthouse CI starts the preview build and runs ${preset} three times on each main page, writing the reports to .lighthouseci; lighthouserc.cjs holds no assertions, because the limits are this fitness function's conditions and radical check judges them. radical sense lighthouse reads the reports: the median per page and device class, and the worst page as web.lab.*.max{device=${device}}. Total Blocking Time stands in for INP, which needs real interactions (a navigation report has none). TBT is main-thread CPU time, so its limit is scaled: multiplied by the speed ratio the machine sensor measures when the runner is slower than the reference machine, never below ×1. LCP is not scaled. Under Lighthouse's simulated throttling it is computed from the observed load, with the network modelled and the CPU work multiplied, so a slow runner does lengthen it; but on most pages the modelled network dominates, and stretching the whole limit by the CPU ratio would let a heavier page pass on a slow runner. Keep the runners of one class instead (or calibrate throttling.cpuSlowdownMultiplier from the benchmarkIndex in the reports, as Lighthouse's throttling documentation describes); a page that renders in the browser, whose LCP waits on JavaScript, may add "scaled" to its LCP line. Pages behind sign-in need a puppeteerScript that signs in first.`,
    }
  }
  return {
    ...common,
    id: `ff-lab-${device}-trend`, label: `No lab regression on ${device === 'mobile' ? 'phones' : 'desktops'}`, when: { DEVICES: devices, LAB: ['baseline'] }, checks: ['req-lab-trend'],
    threshold: `For the slowest main page, median of three runs with ${preset}: LCP, CLS and Total Blocking Time each at most {{LAB_MARGIN}}% above the median of the main branch's latest seven runs`,
    measure: 'lighthouse',
    metrics: `web.lab.lcp.max{device=${device}} <= baseline + {{LAB_MARGIN}}%
web.lab.cls.max{device=${device}} <= baseline + {{LAB_MARGIN}}%
web.lab.tbt.max{device=${device}} <= baseline + {{LAB_MARGIN}}%`,
    description: `For a front end that starts above the budget: every pull request runs ${preset} three times on each main page and radical sense lighthouse reads the medians; each value may be at most {{LAB_MARGIN}}% worse than the main branch's. The job on main keeps its reports/metrics file as an artifact, and the pull request's job passes the latest seven to radical check with --baseline, which compares with their median. Both run on runners of one class, so the speed of the machine cancels out. lighthouserc.cjs holds no assertions: the conditions are the model's. When the pages are within the budget ({{LCP_MS}} ms LCP, {{CLS}} CLS, {{TBT_MS}} ms TBT), answer the lab question again with fixed limits.`,
  }
}

/** Reflow and target size, for one target size: a Playwright test that measures and writes radical-metrics/1. */
function layout(min: '24' | '44'): FitnessSpec {
  return {
    id: `ff-layout-${min}`, label: 'Pages reflow, targets large enough', when: { TOUCH: [min] },
    characteristic: 'interaction-capability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: ['adr-mobile-layout'], checks: ['req-reflow', 'req-targets'],
    threshold: `On every main page, in a 320 CSS px window, on iPhone 15, on Pixel 7 and on a 1280 px desktop: 0 px of horizontal scrolling, and 0 pointer targets under ${min} × ${min} CSS px that are not inside a sentence, labelled by a large enough label, or spaced so that a ${min} px circle around them touches no other target. Once the measure line "playwright tests/mobile-layout.spec.ts --project chromium" is added to this fitness function (a pack cannot know the project's tests), its conditions are: ux.mobile.overflow_px.max <= 0 px, and ux.mobile.small_targets <= 0`,
    description: `A Playwright test opens each main page in four viewports (320 CSS px wide, the width of a 1280 px window at 400% zoom; iPhone 15 and Pixel 7 as Playwright emulates them, with touch; Desktop Chrome) and measures how far the page scrolls sideways and which pointer targets are smaller than ${min} × ${min} CSS px, applying the exceptions of WCAG 2.5.8: a link inside a sentence, an input with a label of the size (its equivalent), and the spacing rule. It judges nothing: it lists what it found in the test report and, when radical sense playwright runs it, writes ux.mobile.overflow_px.max (px, the worst page and viewport) and ux.mobile.small_targets (a count over every page and viewport) as radical-metrics/1 into RADICAL_METRICS_DIR, so the model's conditions decide. Run it in a Chromium project (Firefox does not emulate isMobile). Content hidden with overflow-x: hidden does not scroll and is not seen here; a two-dimensional part (a map, a wide table) belongs in its own scroll container, which the page's width does not count.`,
    tool: 'Playwright (@playwright/test 1.5x or later)',
    language: 'ts',
    snippet: `// tests/mobile-layout.spec.ts: measures; the model's conditions judge
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { devices, test, type BrowserContextOptions } from '@playwright/test'

const PAGES = ['/', '/search', '/checkout']   // the main pages
const MIN = ${min}                                 // the target size decided, in CSS px
const VIEWPORTS: Record<string, BrowserContextOptions> = {
  '320 px (400% zoom)': { viewport: { width: 320, height: 640 } },
  'iPhone 15': devices['iPhone 15'],
  'Pixel 7': devices['Pixel 7'],
  'desktop': devices['Desktop Chrome'],
}
const TARGETS = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [tabindex]:not([tabindex="-1"])'

test('main pages reflow and their targets are large enough', async ({ browser }, testInfo) => {
  let overflow = 0
  let small = 0
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ ...options, baseURL: testInfo.project.use.baseURL })
    const page = await context.newPage()
    for (const path of PAGES) {
      await page.goto(path)
      await page.evaluate(() => document.fonts.ready)
      const width = page.viewportSize()!.width
      const found = await page.evaluate(({ min, width, selector }) => {
        const sideways = Math.max(0, document.documentElement.scrollWidth - width)
        const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.checkVisibility() && !el.closest('[inert]'))
        const boxes = targets.map((el) => el.getBoundingClientRect())
        const under = (r: DOMRect) => r.width < min || r.height < min
        const centre = (r: DOMRect) => [r.x + r.width / 2, r.y + r.height / 2]
        // WCAG 2.5.8 exceptions: inline in a sentence; an input whose label is large enough
        const exempt = (el: HTMLElement) =>
          (getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length)
          || [...((el as HTMLInputElement).labels ?? [])].some((l) => !under(l.getBoundingClientRect()))
        const fails = targets.flatMap((el, i) => {
          const r = boxes[i]
          if (!under(r) || exempt(el)) return []
          // spacing: a circle of diameter MIN on its centre touches no other target and no other small target's circle
          const [x, y] = centre(r)
          const crowded = boxes.some((o, j) => j !== i && !targets[j].contains(el) && !el.contains(targets[j])
            && (Math.hypot(Math.max(o.left - x, 0, x - o.right), Math.max(o.top - y, 0, y - o.bottom)) < min / 2
              || (under(o) && Math.hypot(centre(o)[0] - x, centre(o)[1] - y) < min)))
          const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)
          return crowded ? [el.tagName.toLowerCase() + ' "' + name + '" ' + Math.round(r.width) + '×' + Math.round(r.height)] : []
        })
        return { sideways, fails }
      }, { min: MIN, width, selector: TARGETS })
      overflow = Math.max(overflow, found.sideways)
      small += found.fails.length
      if (found.sideways) testInfo.annotations.push({ type: 'scrolls sideways', description: name + ' ' + path + ': ' + found.sideways + ' px' })
      for (const f of found.fails) testInfo.annotations.push({ type: 'small target', description: name + ' ' + path + ': ' + f })
    }
    await context.close()
  }
  const dir = process.env.RADICAL_METRICS_DIR   // set by radical sense playwright
  if (dir) writeFileSync(join(dir, 'mobile-layout.json'), JSON.stringify({
    format: 'radical-metrics', version: 1, source: 'mobile-layout.spec.ts', at: new Date().toISOString(),
    measurements: [
      { metric: 'ux.mobile.overflow_px.max', value: overflow, unit: 'px' },
      { metric: 'ux.mobile.small_targets', value: small },
    ],
  }))
})`,
  }
}

const pack: PackSpec = {
  id: 'concern-mobile-performance',
  name: 'Mobile and perceived performance',
  group: 'ux',
  description: 'How fast a web front end feels and whether it works on a phone: the Core Web Vitals budget in the lab on every change and in the field from real users, for phones and desktops each on its own, Reflow at 320 CSS px, touch target size, and screenshots on phone viewports.',
  tags: ['ux', 'mobile', 'performance', 'core web vitals', 'lighthouse', 'reflow', 'touch targets', 'visual regression'],
  concern: {
    id: 'mobile-performance',
    trigger: 'LIST NODES WHERE type = "webapp" AND external != true',
    why: 'these are web front ends that people open on phones and computers, so how fast they must feel, how that is measured, and how they must work on a small screen has to be decided.',
  },
  sources: [
    { title: 'web.dev: Web Vitals (LCP, INP, CLS, measured at the 75th percentile)', url: 'https://web.dev/articles/vitals' },
    { title: 'web.dev: How the Core Web Vitals metrics thresholds were defined', url: 'https://web.dev/articles/defining-core-web-vitals-thresholds' },
    { title: 'web.dev: Why lab and field data can be different', url: 'https://web.dev/articles/lab-and-field-data-differences' },
    { title: 'GoogleChrome/web-vitals: the library that measures the vitals in the page', url: 'https://github.com/GoogleChrome/web-vitals' },
    { title: 'Lighthouse CI: configuration (collect, settings, preset)', url: 'https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md' },
    { title: 'Lighthouse: network and CPU throttling', url: 'https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md' },
    { title: 'Lighthouse: score variability', url: 'https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md' },
    { title: 'W3C: Understanding WCAG 2.2, Success Criterion 1.4.10 Reflow', url: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html' },
    { title: 'W3C: Understanding WCAG 2.2, Success Criterion 2.5.8 Target Size (Minimum)', url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html' },
    { title: 'W3C: Understanding WCAG 2.2, Success Criterion 2.5.5 Target Size (Enhanced)', url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html' },
    { title: 'Apple Human Interface Guidelines: Accessibility (hit targets of at least 44 × 44 pt)', url: 'https://developer.apple.com/design/human-interface-guidelines/accessibility' },
    { title: 'Playwright: Emulation (devices, viewport, isMobile, hasTouch)', url: 'https://playwright.dev/docs/emulation' },
    { title: 'Playwright: Visual comparisons (toHaveScreenshot)', url: 'https://playwright.dev/docs/test-snapshots' },
  ],
  questions: [
    {
      key: 'DEVICES', title: 'Devices', label: 'On which devices is the budget measured?',
      hint: 'Phones and desktops differ several times over in CPU and network, so Google judges the vitals for each on its own. Measuring a device class nobody uses costs CI time; leaving out the one most users have hides where the budget breaks.',
      default: 'mobile',
      options: [
        { value: 'mobile', label: 'phones (mobile first)', description: 'The lab runs Lighthouse\'s mobile default and the field data is judged for phones. Pick it for public sites and apps where most visits come from phones, which is most of them; desktops then pass by a wide margin.' },
        { value: 'both', label: 'phones and desktops, each against the budget', description: 'Both lab presets run on every pull request and both device classes are judged in the field. Pick it when a large share of the work happens on desktops (business tools, dashboards) and phones matter too.' },
        { value: 'desktop', label: 'desktops only', description: 'Only Lighthouse\'s desktop preset runs. Pick it for an internal tool used on managed desktops, where analytics show almost no phones. Reflow at 320 CSS px and target size still hold: people zoom on desktops too.' },
      ],
    },
    {
      key: 'LAB', title: 'Lab budget', label: 'How does the lab hold each pull request?',
      hint: 'Fixed limits say what good is; a front end that is already slower than that would fail every pull request until it is rewritten. Comparing with the main branch keeps it from getting worse while it is brought within the budget.',
      default: 'budget',
      options: [
        { value: 'budget', label: 'fixed limits from the budget', description: 'Each main page must stay within the LCP, CLS and Total Blocking Time limits on every pull request. Pick it for a new front end, or one that is already within the budget.' },
        { value: 'baseline', label: 'no regression against the main branch', description: 'Each value may be only a set percentage worse than the median of the main branch\'s latest runs. Pick it for an existing front end above the budget, until it is within it; then switch to fixed limits.' },
      ],
    },
    {
      key: 'FIELD', title: 'Field data', label: 'Where do the field vitals come from?',
      hint: 'The lab simulates one phone on one network; what users get is only known from their own browsers. Field data needs a page that reports it, an endpoint that stores it and a job that summarises it.',
      default: 'rum',
      options: [
        { value: 'rum', label: 'our own real-user monitoring (the web-vitals library sending to our endpoint)', description: 'The page reports LCP, INP and CLS with the web-vitals library to an endpoint of ours; a nightly job writes the 75th percentiles as measurements. Pick it when the front end is live, or about to be, and you can store a few events per visit.' },
        { value: 'none', label: 'none yet: the lab stands in until there is real-user data', description: 'Only the lab budget is checked. Pick it before launch, or when no endpoint can be added yet; plan the field data, as only it shows INP and real networks.' },
      ],
    },
    {
      key: 'TOUCH', title: 'Target size', label: 'How large must a touch or click target be?',
      hint: 'Small targets are missed by thumbs, tremors and people on the move. WCAG 2.2 AA asks for 24 × 24 CSS px (or enough space around a smaller one); platform guides ask for more.',
      default: '24',
      options: [
        { value: '24', label: '24 × 24 CSS px (WCAG 2.2 Target Size Minimum, level AA)', description: 'What WCAG 2.2 AA, EN 301 549 and the European Accessibility Act require, with its exceptions (a link in a sentence, a smaller target with enough space around it). Pick it for dense business screens used mostly with a mouse.' },
        { value: '44', label: '44 × 44 CSS px (Apple\'s guideline, WCAG 2.5.5 level AAA)', description: 'What Apple\'s guidelines and WCAG 2.5.5 (AAA) ask, close to Material Design\'s 48 × 48 dp. Pick it for front ends used mostly on phones, by the public, or by people on the move.' },
      ],
    },
    {
      key: 'VISUAL', title: 'Screenshots', label: 'Are pages compared with approved screenshots on phones?',
      hint: 'A layout that breaks on a phone is seldom seen by a team working on desktops. Screenshot comparison catches it, at the cost of approving every intended change.',
      default: 'yes',
      options: [
        { value: 'yes', label: 'screenshots on phone viewports compared on every pull request', description: 'Playwright takes each main page on iPhone 15 and Pixel 7 viewports and compares it with the approved screenshot. Pick it when the front end is used on phones and the layout changes often. Not for a desktop-only tool.' },
        { value: 'no', label: 'no screenshot comparison', description: 'The layout test (Reflow, target size) is the only check of the layout on phones. Pick it for a desktop-only tool, or while screens change too often for approved screenshots to last.' },
      ],
    },
  ],
  details: [
    { key: 'LCP_MS', label: 'Largest Contentful Paint at most (ms)?', default: '2500', number: true },
    { key: 'INP_MS', label: 'Interaction to Next Paint at the 75th percentile of real visits at most (ms)?', default: '200', number: true },
    { key: 'CLS', label: 'Cumulative Layout Shift at most?', default: '0.1', number: true },
    { key: 'TBT_MS', label: 'Total Blocking Time in the lab at most, on the reference machine (ms)?', default: '200', number: true },
    { key: 'LAB_MARGIN', label: 'With no regression: how much worse than the main branch may a lab value be (%)?', default: '10', number: true },
  ],
  need: {
    label: 'Fast and usable on the devices people have',
    text: 'People open this front end on their own phones and computers, over networks they do not choose, some zoomed in, most with a thumb. A page that paints late, jumps while it loads, answers a tap slowly, scrolls sideways or has targets too small to hit loses them, however it looks on a developer\'s laptop. The budget it is held to and the rules for small screens must be written down, measured on every change and, once it is live, from real visits, and judged in one place. The checks assume the main pages are listed in the tests (/, /search and /checkout in the snippets), a preview server on http://localhost:4173 (npm run preview), and, with real-user monitoring, a table rum_events(name, value, device, page_group, received_at) that the page\'s beacons fill.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-lab-budget', label: 'Lab budget holds', when: { LAB: ['budget'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes the front end',
      action: 'keep every main page, in the median of three Lighthouse runs for {{DEVICES}}, within a Largest Contentful Paint of {{LCP_MS}} ms, a Cumulative Layout Shift of {{CLS}} and a Total Blocking Time of {{TBT_MS}} ms on the reference machine',
      rationale: 'Field data arrives after release; the lab catches a regression in the pull request that causes it. Total Blocking Time is the lab\'s stand-in for INP, which needs real interactions (web.dev, Why lab and field data can be different; Lighthouse CI).',
      scenario: { label: 'Heavier page refused', given: 'a pull request that makes the largest image of a main page three times heavier', when: 'Lighthouse CI collects and radical check judges the measurements', then: 'the LCP condition fails for each device class measured, naming the page\'s value against {{LCP_MS}} ms' },
    },
    {
      id: 'req-lab-trend', label: 'No lab regression', when: { LAB: ['baseline'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes the front end',
      action: 'keep the Largest Contentful Paint, Cumulative Layout Shift and Total Blocking Time of every main page, in the median of three Lighthouse runs for {{DEVICES}}, within {{LAB_MARGIN}}% of the median of the main branch\'s latest seven runs',
      rationale: 'A front end above the budget cannot meet fixed limits at once; holding the line against the main branch stops it getting worse while it is brought within them (Lighthouse, score variability: compare like with like, on one class of machine).',
      scenario: { label: 'Regression refused', given: 'a main page whose LCP on main is a steady 3800 ms', when: 'a pull request makes it 25% slower', then: 'the LCP condition fails against the main branch\'s median plus {{LAB_MARGIN}}%' },
    },
    {
      id: 'req-field-vitals', label: 'Field vitals within budget', when: { FIELD: ['rum'] }, ears_type: 'ubiquitous',
      action: 'meet, at the 75th percentile of real page loads over 28 days, for each page group and for {{DEVICES}}, a Largest Contentful Paint within {{LCP_MS}} ms, an Interaction to Next Paint within {{INP_MS}} ms and a Cumulative Layout Shift of at most {{CLS}}',
      rationale: 'These are the thresholds of a "good" experience, judged at the 75th percentile of field data per device class (web.dev, Web Vitals: LCP 2.5 s, INP 200 ms, CLS 0.1; How the thresholds were defined).',
      scenario: { label: 'Field vitals within budget', given: '28 days of real-user measurements per page group and device class', when: 'the nightly job writes their 75th percentiles and radical check judges them', then: 'LCP is within {{LCP_MS}} ms, INP within {{INP_MS}} ms and CLS at most {{CLS}} for the worst page group of each device class' },
    },
    {
      id: 'req-reflow', label: 'Reflows at 320 CSS px', ears_type: 'ubiquitous',
      action: 'present every page in a window 320 CSS px wide, as at 400% zoom of a 1280 px window, and on phone viewports, with 0 px of horizontal scrolling and nothing cut off, except parts that need two dimensions to be read (maps, diagrams, wide data tables), which scroll inside their own container',
      rationale: 'People who zoom to read, and people on small phones, lose content that sits beside the viewport; WCAG 2.2 AA requires reflow at 320 CSS px (W3C, Understanding SC 1.4.10 Reflow).',
      scenario: { label: 'No sideways scrolling', given: 'each main page in a 320 CSS px window and on the phone viewports', when: 'the layout test measures how far the page scrolls sideways', then: 'it scrolls 0 px sideways in each' },
    },
    {
      id: 'req-targets', label: 'Targets large enough', ears_type: 'ubiquitous',
      action: 'make every pointer target at least {{TOUCH}}, except a link inside a sentence, a control whose label of that size activates it, and a smaller target spaced so that a circle of that diameter on its centre touches no other target',
      rationale: 'Small, crowded targets are missed by thumbs, tremors and people on the move (W3C, Understanding SC 2.5.8 Target Size (Minimum) and 2.5.5 Target Size (Enhanced); Apple Human Interface Guidelines).',
      scenario: { label: 'Small icon button caught', given: 'a main page with a 16 × 16 CSS px icon button beside another button', when: 'the layout test measures the targets', then: 'it counts the icon button as a small target and the condition on ux.mobile.small_targets fails' },
    },
    {
      id: 'req-phone-screens', label: 'Phone screenshots approved', when: { VISUAL: ['yes'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes the front end',
      action: 'compare each main page on iPhone 15 and Pixel 7 viewports with its approved screenshot, and refuse a difference until a person approves the new screenshot in the same pull request',
      rationale: 'A layout that breaks on a phone is seldom seen by a team that works on desktops; emulated viewports make the comparison repeatable (Playwright, Emulation and Visual comparisons).',
      scenario: { label: 'Broken phone layout caught', given: 'approved screenshots of the main pages on iPhone 15 and Pixel 7', when: 'a pull request widens a fixed element past the phone\'s width', then: 'the screenshot comparison fails on both phones until the change is fixed or the new screenshots are approved' },
    },
  ],
  adrs: [
    {
      id: 'adr-perf-budget', label: 'Pages held to the Core Web Vitals',
      decision: 'Pages are held to the Core Web Vitals at web.dev\'s "good" thresholds, for {{DEVICES}}, each device class judged on its own: Largest Contentful Paint within {{LCP_MS}} ms, Interaction to Next Paint within {{INP_MS}} ms and Cumulative Layout Shift at most {{CLS}}, at the 75th percentile of real page loads over 28 days. In the lab, on every pull request: Lighthouse CI collects three runs of each main page (Lighthouse\'s mobile default for phones, its desktop preset for desktops) and only collects; radical sense lighthouse reads the reports, and the fitness functions\' conditions judge the medians, so the limits live in the model and not in lighthouserc. The lab is held with {{LAB}}. The lab has no INP: Total Blocking Time within {{TBT_MS}} ms stands in for it, its limit scaled to the speed of the runner, because TBT is CPU time; LCP is not scaled, and the runners are kept of one class. Field data: {{FIELD}}. With our own real-user monitoring, the page reports with the web-vitals library to our endpoint, and a nightly job writes the 75th percentiles per page group and device class as radical-metrics/1 for radical check. The Chrome UX Report is not read by any check: it covers only origins with enough Chrome traffic, trails by 28 days and cannot be tied to a release; PageSpeed Insights shows it to anyone who looks. The JavaScript budget per route is decided in the Frontend stack pack; accessibility as a whole in the Accessibility pack.',
      consequences: '• A regression fails the pull request that causes it, with the page, the device class and the value.\n• The numbers live in the model: changing the budget is a change of the decision\'s details, not of a CI file.\n• Lab runs add minutes to every pull request (three runs a page, per device class); keep the list of main pages short.\n• The lab simulates one phone and one network; only the field data, when there is any, says what users get, and it arrives days after a release.\n• A runner of another class shifts lab timings: TBT\'s limit follows it, LCP\'s does not.',
      alternatives: '1. Assertions in lighthouserc: the limits then live in a CI file, apart from the decision, and the model cannot show them.\n2. Lighthouse\'s performance score as the gate: one number that mixes metrics and changes its weights between versions.\n3. Field data only (CrUX or RUM): the truth, but only after release, and no check of the pull request that caused a regression.\n4. A commercial RUM service (SpeedCurve, Datadog, New Relic): the same data without our own endpoint, at a price per page view; its export then writes the measurements.',
    },
    {
      id: 'adr-mobile-layout', label: 'Pages reflow and can be touched',
      decision: 'Every page works in a window 320 CSS px wide (a 1280 px window at 400% zoom) and on phone viewports without scrolling sideways, as WCAG 2.2 SC 1.4.10 requires; parts that need two dimensions (maps, diagrams, wide tables) scroll inside their own container. Every pointer target is at least {{TOUCH}}, with the exceptions WCAG 2.2 SC 2.5.8 allows. A Playwright test measures both on every pull request in four viewports (320 CSS px; iPhone 15 and Pixel 7 as Playwright emulates them; a 1280 px desktop) and writes what it found as radical-metrics/1, which the model\'s conditions judge. Screenshots on phones: {{VISUAL}}; when compared, they are taken in the Playwright Docker image of the version in use, locally and in CI alike, as fonts and rendering differ between systems. The rest of WCAG 2.2 AA (automated rules, the keyboard, the manual audit) is decided in the Accessibility pack; the framework and browser support in the Frontend stack pack.',
      consequences: '• A layout that scrolls sideways or a target too small to hit fails the pull request, with the page, viewport and element in the test report.\n• Emulated phones are not real ones: CPU, memory and the browser chrome of a real device are not tested here.\n• With screenshots, every intended visual change needs its new screenshots approved in the pull request.\n• Larger targets take room: dense tables and toolbars need a design that spaces them.',
      alternatives: '1. Manual checks on a device bench before release: catches what emulation misses, but late and by hand.\n2. axe-core\'s target-size rule alone: checks 2.5.8 but not Reflow, and gives no count to judge.\n3. A cloud device farm (BrowserStack, Sauce Labs) for every pull request: real devices, at a price per minute and with slower runs.',
    },
  ],
  fitness: [
    lab('mobile', 'budget'),
    lab('desktop', 'budget'),
    lab('mobile', 'baseline'),
    lab('desktop', 'baseline'),
    {
      id: 'ff-field-vitals', label: 'Field vitals within budget', when: { FIELD: ['rum'] },
      characteristic: 'performance-efficiency', scope: 'holistic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated',
      implements: ['adr-perf-budget'], checks: ['req-field-vitals'],
      threshold: '75th percentile over 28 days, for the worst page group of each device class measured: LCP within {{LCP_MS}} ms, INP within {{INP_MS}} ms, CLS at most {{CLS}}. Once the nightly job writes its file, these conditions go into this fitness function\'s metrics (a pack names only the built-in sensors): web.field.lcp.p75.max{device=mobile} <= {{LCP_MS}} ms, web.field.inp.p75.max{device=mobile} <= {{INP_MS}} ms, web.field.cls.p75.max{device=mobile} <= {{CLS}}, and the same with device=desktop for each device class measured',
      description: 'The page reports LCP, INP and CLS from real visits with the web-vitals library, sending each with navigator.sendBeacon to /rum, which stores the name, the value, the device class (mobile when the user agent contains "Mobi", as MDN advises, else desktop) and the page group in rum_events. A nightly job runs the script below: the 75th percentile per metric, device class and page group over the last 28 days (page groups with fewer than 100 loads left out), and the worst page group per device class as web.field.*.p75.max, written as a radical-metrics/1 file that radical check reads with --metrics. No sensor of radical sense reads it, so this fitness function states no measure; nothing reads the Chrome UX Report either (see the decision).',
      tool: 'web-vitals 6.x in the page; a nightly Node.js script over the RUM table (PostgreSQL, pg 8.x); radical check --metrics',
      language: 'ts',
      snippet: `// src/rum.ts, loaded by every page: what real visits get
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'

const device = /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
const pageGroup = document.body.dataset.pageGroup ?? location.pathname
function send({ name, value }: Metric): void {
  navigator.sendBeacon('/rum', JSON.stringify({ name, value, device, page_group: pageGroup }))
}
onLCP(send)
onINP(send)
onCLS(send)

// scripts/rum-metrics.mts, nightly:
//   node scripts/rum-metrics.mts > reports/metrics/rum.json && npx radical check --metrics reports/metrics
import pg from 'pg'

const METRIC: Record<string, string> = { LCP: 'web.field.lcp.p75', INP: 'web.field.inp.p75', CLS: 'web.field.cls.p75' }
const UNIT: Record<string, string | undefined> = { LCP: 'ms', INP: 'ms' }
const db = new pg.Client()   // PGHOST, PGDATABASE, PGUSER, PGPASSWORD
await db.connect()
const { rows } = await db.query(\`
  SELECT name, device, page_group, percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75
  FROM rum_events
  WHERE received_at > now() - interval '28 days'
  GROUP BY name, device, page_group
  HAVING count(*) >= 100\`)
await db.end()
type Measurement = { metric: string; value: number; unit?: string; labels: Record<string, string> }
const measurements: Measurement[] = []
const worst = new Map<string, Measurement>()   // the worst page group per metric and device class
for (const r of rows) {
  const m = { metric: METRIC[r.name], value: r.p75, unit: UNIT[r.name], labels: { device: r.device, page: r.page_group } }
  measurements.push(m)
  const key = r.name + ' ' + r.device
  if ((worst.get(key)?.value ?? -1) < m.value) worst.set(key, { ...m, metric: m.metric + '.max', labels: { device: r.device } })
}
measurements.push(...worst.values())
process.stdout.write(JSON.stringify({ format: 'radical-metrics', version: 1, source: 'rum', at: new Date().toISOString(), measurements }))`,
    },
    layout('24'),
    layout('44'),
    {
      id: 'ff-phone-screens', label: 'Phone screenshots unchanged', when: { VISUAL: ['yes'] },
      characteristic: 'interaction-capability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
      implements: ['adr-mobile-layout'], checks: ['req-phone-screens'],
      threshold: '0 main pages on the iPhone 15 and Pixel 7 projects whose full-page screenshot differs from the approved one',
      description: 'Two Playwright projects emulate iPhone 15 (WebKit) and Pixel 7 (Chromium) as Playwright\'s device list describes them; a test takes each main page whole, after its fonts load, and compares it with the approved screenshot kept beside the test (one per page, project and platform). Parts that change by themselves (dates, avatars) are masked. Screenshots are taken in the Playwright Docker image of the @playwright/test version in use (mcr.microsoft.com/playwright:v<version>-noble), in CI and when approving with --update-snapshots, so fonts and rendering match.',
      tool: 'Playwright (@playwright/test 1.5x or later, toHaveScreenshot)',
      language: 'ts',
      snippet: `// playwright.config.ts (the part that matters)
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
  ],
})

// tests/phone-screens.spec.ts
import { expect, test } from '@playwright/test'

for (const path of ['/', '/search', '/checkout']) {
  test('page ' + path + ' looks as approved', async ({ page }) => {
    await page.goto(path)
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot({ fullPage: true, mask: [page.locator('[data-volatile]')] })
  })
}`,
    },
  ],
}

export default pack
