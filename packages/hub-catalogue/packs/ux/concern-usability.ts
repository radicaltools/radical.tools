import type { FitnessSpec, PackSpec } from '../../src/packSpec'

const FORCES = 'People use this web front end to get their tasks done, most of them without training and many on a small screen. The forces: every page added by a different person or team drifts a little from the others, until the same thing is named, placed and linked differently on each; a link repeated "to be safe" adds tab stops, screen-reader noise and the doubt whether two links lead to the same place; link names such as "Read more" say nothing out of context, and screen-reader users often list the links of a page on their own; forms are where people give up, and an error that is shown late, vaguely or out of sight costs the whole form; an empty list with no word of explanation looks broken; and usability problems are cheap to find with a few evaluators and a checklist, and expensive once users have learned to work around them.'
/** Every decision of the pack: what the heuristic review and the crawls implement. */

/** The helper every measuring test carries: writes a radical-metrics/1 file
 *  where radical sense playwright reads it. */
const WRITE = `type Measurement = { metric: string; value: number; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}`

const HEAD = (file: string, imports: string, from: string) => `// tests/ux/${file}: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/ux/${file}
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test${imports} } from '@playwright/test'
import { ${from} } from './journeys'`

/** How often one link target may appear in a page's main content. */
function linksRepeated(variant: 'once' | 'limit'): FitnessSpec {
  const limit = variant === 'once' ? '1' : '{{MAX_LINK_REPEATS}}'
  return {
    id: `ff-links-repeated-${variant}`, label: 'No link target repeated', when: { LINK_REPEAT: [variant] },
    characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: [`adr-links-${variant}`], checks: [`req-link-repeat-${variant}`],
    threshold: `ux.links.repeated.max <= ${limit}: on every page of the main journeys, no link target appears more than ${variant === 'once' ? 'once' : '{{MAX_LINK_REPEATS}} times'} in the main content outside its navigation (the same link 5 times on a page measures 5 and fails)`,
    description: `A Playwright test opens each page of the main journeys (PAGES in tests/ux/journeys.ts) and counts, inside the main landmark, the visible links to each target, SVG links included. A target is a page: origin, path and query, a folder and its index.html being one page, and the #fragment left out, so links to different sections of one long page (a manual, a reference) count as one target; that is the point: each is another tab stop to the same page, and a page that needs many is better served by its own table of contents. In-page links (skip links, an error summary's) are left out, and so are links inside a nav: breadcrumbs, a table of contents. It writes the largest count of each page as ux.links.repeated{page=…} and the largest of all as ux.links.repeated.max, and fails on a page over the limit, naming the target. The header, navigation and footer are left out on purpose: the same link in the navigation and once in the text is expected. Bind it with the sensor radical sense playwright tests/ux/links-repeated.spec.ts and the condition ux.links.repeated.max <= ${limit}.`,
    tool: 'Playwright (@playwright/test), measured by radical sense playwright',
    language: 'ts',
    snippet: `${HEAD('links-repeated.spec.ts', '', 'PAGES')}   // [{ path: '/' }, { path: '/pricing' }, …]: the main journeys' pages

const LIMIT = ${limit}   // the decision: how often one target may be linked in a page's main content

${WRITE}

test('no link target repeats in the main content', async ({ page }) => {
  const found: Array<{ path: string; href: string; times: number }> = []
  for (const { path } of PAGES) {
    await page.goto(path)
    const counts = await page.locator('main').first().evaluate((main) => {
      const times: Record<string, number> = {}
      for (const a of main.querySelectorAll<HTMLAnchorElement | SVGAElement>('a[href]')) {
        if (a.closest('nav, [role="navigation"]') || !a.checkVisibility()) continue   // breadcrumbs, tables of contents, hidden links
        // an SVG link's href is an SVGAnimatedString (links in diagrams)
        const url = new URL(a instanceof SVGAElement ? a.href.baseVal : a.href, document.baseURI)
        if (url.origin + url.pathname === location.origin + location.pathname && url.hash) continue   // skip links, error summaries
        // a target is a page: its #fragment is left out, and a folder and its index.html are one page
        const target = url.origin + url.pathname.replace(/\\/(index\\.html)?$/, '') + url.search
        times[target] = (times[target] ?? 0) + 1
      }
      return times
    })
    const [href, times] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    found.push({ path, href, times })
  }
  writeMetrics('links-repeated.json', [
    ...found.map((p) => ({ metric: 'ux.links.repeated', value: p.times, labels: { page: p.path } })),
    { metric: 'ux.links.repeated.max', value: Math.max(0, ...found.map((p) => p.times)) },
  ])
  for (const p of found) expect.soft(p.times, \`\${p.path} links to \${p.href} \${p.times} times\`).toBeLessThanOrEqual(LIMIT)
})`,
  }
}

/** Whether link names say where they go, alone or with their context. */
function linkTexts(variant: 'unique' | 'context'): FitnessSpec {
  const unique = variant === 'unique'
  return {
    id: `ff-link-texts-${variant}`, label: 'Link names say where they go', when: { LINK_TEXT: [variant] },
    characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: ['adr-links-once', 'adr-links-limit'], checks: [`req-link-text-${variant}`],
    threshold: unique
      ? 'ux.links.ambiguous{by=name} = 0 and ux.links.vague = 0: on no page of the main journeys does one link name lead to two different targets, and no link is named only "click here", "read more", "more" or the like (or nothing)'
      : 'ux.links.ambiguous{by=context} = 0: on no page of the main journeys do two links with the same name in the same list item, table row, paragraph or card lead to different targets',
    description: `A Playwright test opens each page of the main journeys and reads every visible link: its accessible name (simplified: aria-labelledby, aria-label, else its text with image alternatives, aria-hidden parts left out), its target, and its context (the text of the table row around it, else of the nearest list item, cell, paragraph, definition or article, so that two "View" links in one row meet). SVG links are read too. It writes ux.links.ambiguous{by=name} (names on a page that lead to more than one target), ux.links.ambiguous{by=context} (the same, counted by name and context together) and ux.links.vague (links whose whole name is a generic phrase, or empty), and fails on ${unique ? 'an ambiguous name or a vague one' : 'a name that is ambiguous within its context'}. Bind it with radical sense playwright tests/ux/link-texts.spec.ts and ${unique ? 'the conditions ux.links.ambiguous{by=name} <= 0 and ux.links.vague <= 0' : 'the condition ux.links.ambiguous{by=context} <= 0'}. Extend VAGUE with the generic phrases of your language.`,
    tool: 'Playwright (@playwright/test), measured by radical sense playwright',
    language: 'ts',
    snippet: `${HEAD('link-texts.spec.ts', '', 'PAGES')}   // the main journeys' pages

const VAGUE = /^(click here|here|read more|more|learn more|find out more|details|link|this page|continue reading)$/

${WRITE}

test('link names say where they go', async ({ page }) => {
  const ambiguous = { name: [] as string[], context: [] as string[] }
  const vague: string[] = []
  for (const { path } of PAGES) {
    await page.goto(path)
    const links = await page.locator('body').evaluate((body) => {
      const clean = (s: string) => s.replace(/\\s+/g, ' ').trim().toLowerCase()
      // The accessible name, simplified: aria-labelledby, aria-label, else the text with image alternatives.
      const nameOf = (a: Element): string => {
        const ids = a.getAttribute('aria-labelledby')
        if (ids) return ids.split(/\\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
        const label = a.getAttribute('aria-label')
        if (label) return label
        const copy = a.cloneNode(true) as Element
        copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
        copy.querySelectorAll('img').forEach((img) => img.replaceWith(img.alt))
        return copy.textContent ?? ''
      }
      return [...body.querySelectorAll<HTMLAnchorElement | SVGAElement>('a[href]')].filter((a) => a.checkVisibility()).map((a) => {
        // an SVG link's href is an SVGAnimatedString (links in diagrams)
        const url = new URL(a instanceof SVGAElement ? a.href.baseVal : a.href, document.baseURI)
        // the context: the row the link is in, before the nearest list item, cell, paragraph, definition or card
        // (closest() alone stops at the cell, and two "View" links in one row would never meet)
        const context = a.closest('tr, [role="row"]') ?? a.closest('li, td, p, dd, article, [role="listitem"]')
        return { name: clean(nameOf(a)), target: url.origin + url.pathname.replace(/\\/(index\\.html)?$/, '') + url.search, context: clean(context?.textContent ?? '').slice(0, 200) }
      })
    })
    /** The keys that lead to more than one target. */
    const ambiguousBy = (key: (l: (typeof links)[number]) => string): string[] => {
      const targets = new Map<string, Set<string>>()
      for (const l of links) targets.set(key(l), (targets.get(key(l)) ?? new Set<string>()).add(l.target))
      return [...targets].filter(([, t]) => t.size > 1).map(([k, t]) => \`\${path}: "\${k}" leads to \${[...t].join(', ')}\`)
    }
    ambiguous.name.push(...ambiguousBy((l) => l.name))
    ambiguous.context.push(...ambiguousBy((l) => \`\${l.name} in "\${l.context}"\`))
    vague.push(...links.filter((l) => !l.name || VAGUE.test(l.name)).map((l) => \`\${path}: "\${l.name}" to \${l.target}\`))
  }
  writeMetrics('link-texts.json', [
    { metric: 'ux.links.ambiguous', value: ambiguous.name.length, labels: { by: 'name' } },
    { metric: 'ux.links.ambiguous', value: ambiguous.context.length, labels: { by: 'context' } },
    { metric: 'ux.links.vague', value: vague.length },
  ])
${unique
  ? `  expect.soft(ambiguous.name, 'one link name, several targets').toEqual([])
  expect.soft(vague, 'link names that say nothing on their own').toEqual([])`
  : `  expect.soft(ambiguous.context, 'one link name, several targets in the same context').toEqual([])`}
})`,
  }
}

/** The navigation every page shares (and each section's own). */
function navigation(variant: 'shared' | 'sections'): FitnessSpec {
  const sections = variant === 'sections'
  return {
    id: `ff-nav-${variant}`, label: 'Navigation the same on every page', when: { NAVIGATION: [variant] },
    characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: [`adr-nav-${variant}`], checks: [`req-nav-${variant}`],
    threshold: sections
      ? 'ux.nav.variants <= 1: every page of the main journeys shows one and the same header, global navigation and footer (ux.nav.variants{nav=global} = 1), and every page of a section the same section navigation (ux.nav.variants{nav=<section>} = 1)'
      : 'ux.nav.variants{nav=global} = 1: every page of the main journeys shows one and the same header, navigation and footer: the same links and buttons in the same order under the same names',
    description: `A Playwright test opens each page of the main journeys and reads, in order, the links and buttons of the banner landmark, of the navigation named "Main" and of the contentinfo landmark: element, name and target path. The current page's mark (aria-current) is not part of it, and neither is anything inside an element marked data-ux-varies, for what changes on purpose (a basket count, the signed-in name). It writes ux.nav.variants{nav=global}, the number of different sets seen (1 when every page shows the same)${sections ? ', and ux.nav.variants{nav=<section>} for the navigation named "Section" on the pages of each section (PAGES give each page its section; keep a section\'s navigation out of the header)' : ''}, and fails above 1, listing the pages of each set. Bind it with radical sense playwright tests/ux/navigation.spec.ts and the condition ux.nav.variants <= 1.`,
    tool: 'Playwright (@playwright/test), measured by radical sense playwright',
    language: 'ts',
    snippet: `${HEAD('navigation.spec.ts', ', type Locator', 'PAGES')}   // [{ path: '/orders'${sections ? ", section: 'Orders'" : ''} }, …]

const MAIN_NAV = 'Main'          // the aria-label of the shared navigation${sections ? `
const SECTION_NAV = 'Section'    // the aria-label of a section's own navigation` : ''}

${WRITE}

/** The links and buttons of a part, in order, by element, name and target path. */
async function itemsOf(part: Locator): Promise<string> {
  if (!(await part.count())) return '(none)'
  return part.first().evaluate((el) => [...el.querySelectorAll<HTMLElement>('a[href], button')]
    .filter((x) => x.checkVisibility() && !x.closest('[data-ux-varies]'))
    .map((x) => [x.tagName, (x.getAttribute('aria-label') ?? x.textContent ?? '').replace(/\\s+/g, ' ').trim(), x instanceof HTMLAnchorElement ? new URL(x.href).pathname : ''].join(' '))
    .join('\\n'))
}

/** Adds a page to the set it shows. */
const add = (sets: Map<string, string[]>, items: string, path: string) => sets.set(items, [...(sets.get(items) ?? []), path])

test('every page shows the same navigation', async ({ page }) => {
  const global = new Map<string, string[]>()${sections ? `
  const bySection = new Map<string, Map<string, string[]>>()` : ''}
  for (const { path${sections ? ', section' : ''} } of PAGES) {
    await page.goto(path)
    const parts = [page.getByRole('banner'), page.getByRole('navigation', { name: MAIN_NAV, exact: true }), page.getByRole('contentinfo')]
    add(global, (await Promise.all(parts.map(itemsOf))).join('\\n|\\n'), path)${sections ? `
    if (section) {
      const own = bySection.get(section) ?? new Map<string, string[]>()
      add(own, await itemsOf(page.getByRole('navigation', { name: SECTION_NAV, exact: true })), path)
      bySection.set(section, own)
    }` : ''}
  }
  writeMetrics('navigation.json', [
    { metric: 'ux.nav.variants', value: global.size, labels: { nav: 'global' } },${sections ? `
    ...[...bySection].map(([section, sets]) => ({ metric: 'ux.nav.variants', value: sets.size, labels: { nav: section } })),` : ''}
  ])
  expect.soft(global.size, \`pages per navigation: \${JSON.stringify([...global.values()])}\`).toBe(1)${sections ? `
  for (const [section, sets] of bySection) expect.soft(sets.size, \`\${section}: \${JSON.stringify([...sets.values()])}\`).toBe(1)` : ''}
})`,
  }
}

/** What a failed submit shows, for each way of showing errors. */
function formErrors(variant: 'summary' | 'field' | 'live'): FitnessSpec {
  const summary = variant !== 'field'
  const live = variant === 'live'
  const conditions = [
    'ux.forms.unmarked = 0', 'ux.forms.unexplained = 0',
    ...(summary ? ['ux.forms.summary.missing = 0'] : ['ux.forms.focus.missed = 0']),
    ...(live ? ['ux.forms.premature = 0', 'ux.forms.leave.missed = 0'] : []),
  ]
  return {
    id: `ff-forms-${variant}`, label: 'Form errors shown as decided', when: { ERRORS: [variant] },
    characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: [`adr-forms-${variant}`], checks: [`req-errors-${variant}`],
    threshold: `${conditions.join(', ')} over the forms of the main journeys`,
    description: `A Playwright test submits each form of the main journeys empty (FORMS in tests/ux/journeys.ts) and reads what the page shows: A submit button kept disabled while the form is incomplete is clicked anyway, as a person would click it, and nothing happening counts as nothing marked. ux.forms.unmarked counts forms where no field was marked aria-invalid="true"; ux.forms.unexplained counts fields so marked without a message tied to them by aria-describedby or aria-errormessage; ${summary ? 'ux.forms.summary.missing counts forms where focus did not land in a summary linking to every field in error (#id links), or the title does not start with "Error: "' : 'ux.forms.focus.missed counts forms where focus did not move to the first field in error'}${live ? '. On a fresh form it then types one character into the field named in FORMS and counts ux.forms.premature when the field is marked invalid while still being typed in, and ux.forms.leave.missed when leaving it with Tab shows no error' : ''}. Bind it with radical sense playwright tests/ux/form-errors.spec.ts and the conditions ${conditions.map((c) => c.replace(' = ', ' <= ')).join(', ')}.`,
    tool: 'Playwright (@playwright/test), measured by radical sense playwright',
    language: 'ts',
    snippet: `${HEAD('form-errors.spec.ts', ', type Page', 'FORMS')}   // [{ path: '/register', submit: 'Continue', field: 'Email address' }, …]

${WRITE}

/** What the page shows after a submit that failed. */
const shown = (page: Page) => page.evaluate(() => {
  const invalid = [...document.querySelectorAll<HTMLElement>('[aria-invalid="true"]')]
  const explained = (f: HTMLElement) => \`\${f.getAttribute('aria-describedby') ?? ''} \${f.getAttribute('aria-errormessage') ?? ''}\`
    .split(/\\s+/).some((id) => id && document.getElementById(id)?.textContent?.trim())
  // the summary: the nearest element around the focus that links to every field in error, and holds none of them
  let box: Element | null = document.activeElement
  while (box && box !== document.body && !invalid.every((f) => box!.querySelector(\`a[href="#\${CSS.escape(f.id)}"]\`))) box = box.parentElement
  return {
    invalid: invalid.length,
    unexplained: invalid.filter((f) => !explained(f)).length,
    summarised: Boolean(invalid.length && box && box !== document.body && !box.contains(invalid[0]) && document.title.startsWith('Error: ')),
    firstFocused: Boolean(invalid.length) && invalid[0] === document.activeElement,
  }
})

test('failed submits say what is wrong and where', async ({ page }) => {
  const unmarked: string[] = [], missed: string[] = []${live ? ', premature: string[] = [], leaveMissed: string[] = []' : ''}
  let unexplained = 0
  for (const form of FORMS) {
    await page.goto(form.path)
    const submit = page.getByRole('button', { name: form.submit, exact: true })
    await submit.click({ force: await submit.isDisabled() })   // a disabled button takes the click and does nothing, as for a person
    await page.locator('[aria-invalid="true"]').first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined)
    const after = await shown(page)
    if (!after.invalid) unmarked.push(form.path)
    unexplained += after.unexplained
    if (after.invalid && !after.${summary ? 'summarised' : 'firstFocused'}) missed.push(form.path)${live ? `
    await page.goto(form.path)
    const field = page.getByLabel(form.field, { exact: true })
    await field.pressSequentially('a')                       // one character: the answer is not finished yet
    if ((await field.getAttribute('aria-invalid')) === 'true') premature.push(form.path)
    await page.keyboard.press('Tab')                         // leaving the field checks it
    if ((await field.getAttribute('aria-invalid')) !== 'true') leaveMissed.push(form.path)` : ''}
  }
  writeMetrics('form-errors.json', [
    { metric: 'ux.forms.unmarked', value: unmarked.length },
    { metric: 'ux.forms.unexplained', value: unexplained },
    { metric: '${summary ? 'ux.forms.summary.missing' : 'ux.forms.focus.missed'}', value: missed.length },${live ? `
    { metric: 'ux.forms.premature', value: premature.length },
    { metric: 'ux.forms.leave.missed', value: leaveMissed.length },` : ''}
  ])
  expect.soft(unmarked, 'forms that accepted an empty submit or marked no field').toEqual([])
  expect.soft(unexplained, 'fields marked invalid without a message tied to them').toBe(0)
  expect.soft(missed, '${summary ? 'forms without a focused error summary linking each field, or without "Error: " in the title' : 'forms where focus did not move to the first field in error'}').toEqual([])${live ? `
  expect.soft(premature, 'fields marked invalid while still being typed in').toEqual([])
  expect.soft(leaveMissed, 'fields not checked when left').toEqual([])` : ''}
})`,
  }
}

/** What a view with nothing to show says. */
function emptyStates(variant: 'guided' | 'plain'): FitnessSpec {
  const guided = variant === 'guided'
  return {
    id: `ff-empty-${variant}`, label: 'Empty views explain themselves', when: { EMPTY: [variant] },
    characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: ['adr-usability'], checks: [`req-empty-${variant}`],
    threshold: guided
      ? 'ux.empty.silent = 0 and ux.empty.dead_ends = 0: every view that starts empty for a new account says why in at least three words besides its headings, and offers at least one link or button in its main content'
      : 'ux.empty.silent = 0: every view that starts empty for a new account says so in at least three words besides its headings and table headers',
    description: `A Playwright test signs in as a freshly registered account with no data (a storageState the test setup writes) and opens each view that starts empty (EMPTY_VIEWS in tests/ux/journeys.ts: lists, tables, searches without a result, dashboards). It counts ux.empty.silent, views whose main content shows fewer than three words besides headings and table headers (visible text only, so text hidden for assistive technology or by CSS is not read, and a word has a letter: a lone "+" is none), and ux.empty.dead_ends, views without a visible link or button in the main content outside its navigation, and fails on ${guided ? 'either' : 'a silent view'}. Bind it with radical sense playwright tests/ux/empty-states.spec.ts and ${guided ? 'the conditions ux.empty.silent <= 0 and ux.empty.dead_ends <= 0' : 'the condition ux.empty.silent <= 0'}.`,
    tool: 'Playwright (@playwright/test), measured by radical sense playwright',
    language: 'ts',
    snippet: `${HEAD('empty-states.spec.ts', '', 'EMPTY_VIEWS')}   // [{ path: '/orders' }, { path: '/search?q=zzzz' }, …]

test.use({ storageState: 'tests/ux/.auth/new-account.json' })   // a freshly registered account with no data

${WRITE}

test('empty views say why they are empty${guided ? ' and what to do next' : ''}', async ({ page }) => {
  const silent: string[] = [], deadEnds: string[] = []
  for (const { path } of EMPTY_VIEWS) {
    await page.goto(path)
    const view = await page.getByRole('main').evaluate((main) => {
      // the words shown besides headings and table headers: visible text only, a word has a letter ("+" is none)
      const skip = 'h1, h2, h3, h4, h5, h6, [role="heading"], th, [role="columnheader"], nav, script, style, [aria-hidden="true"]'
      const words: string[] = []
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const parent = text.parentElement
        if (!parent || parent.closest(skip) || !parent.checkVisibility()) continue
        words.push(...(text.textContent ?? '').split(/\\s+/).filter((w) => /\\p{L}/u.test(w)))
      }
      const actions = [...main.querySelectorAll<HTMLElement>('a[href], button')].filter((x) => !x.closest('nav') && x.checkVisibility())
      return { words: words.length, actions: actions.length }
    })
    if (view.words < 3) silent.push(path)
    if (!view.actions) deadEnds.push(path)
  }
  writeMetrics('empty-states.json', [
    { metric: 'ux.empty.silent', value: silent.length },
    { metric: 'ux.empty.dead_ends', value: deadEnds.length },
  ])
  expect.soft(silent, 'empty views that say nothing').toEqual([])${guided ? `
  expect.soft(deadEnds, 'empty views that offer no next step').toEqual([])` : ''}
})`,
  }
}

const pack: PackSpec = {
  id: 'concern-usability',
  name: 'Usability',
  group: 'ux',
  description: 'How easy the web front end is to use, held to ISO 9241-110 and Nielsen\'s heuristics: consistent navigation, links that are neither repeated nor vague, form errors people can recover from, empty views that explain themselves, and a heuristic review on a schedule.',
  tags: ['ux', 'usability', 'navigation', 'links', 'forms', 'errors', 'empty states', 'heuristic evaluation', 'iso 9241-110'],
  concern: {
    id: 'usability',
    trigger: 'LIST RELATIONS WHERE source.type = "person" AND target.type = "webapp" AND target.external != true',
    applyTo: 'target',
    why: 'people use these web front ends, so how navigation, links, form errors and empty views behave, and how usability is reviewed, has to be decided.',
  },
  sources: [
    { title: 'ISO 9241-110:2020, Ergonomics of human-system interaction, Part 110: Interaction principles', url: 'https://www.iso.org/standard/75258.html' },
    { title: 'Nielsen Norman Group: 10 Usability Heuristics for User Interface Design', url: 'https://www.nngroup.com/articles/ten-usability-heuristics/' },
    { title: 'Nielsen Norman Group: How to Conduct a Heuristic Evaluation', url: 'https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/' },
    { title: 'Nielsen Norman Group: Severity Ratings for Usability Problems', url: 'https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/' },
    { title: 'Nielsen Norman Group: Designing Empty States in Complex Applications', url: 'https://www.nngroup.com/articles/empty-state-interface-design/' },
    { title: 'Nielsen Norman Group: Error-Message Guidelines', url: 'https://www.nngroup.com/articles/error-message-guidelines/' },
    { title: 'GOV.UK publishing guidance: Add links', url: 'https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/add-links/' },
    { title: 'GOV.UK Design System: Error summary', url: 'https://design-system.service.gov.uk/components/error-summary/' },
    { title: 'GOV.UK Design System: Validation pattern', url: 'https://design-system.service.gov.uk/patterns/validation/' },
    { title: 'GOV.UK Design System: Service navigation', url: 'https://design-system.service.gov.uk/components/service-navigation/' },
    { title: 'GOV.UK Design System: Back link', url: 'https://design-system.service.gov.uk/components/back-link/' },
    { title: 'W3C: Understanding SC 2.4.4 Link Purpose (In Context)', url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html' },
    { title: 'W3C: Understanding SC 2.4.9 Link Purpose (Link Only)', url: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only.html' },
    { title: 'W3C: Understanding SC 3.2.3 Consistent Navigation', url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html' },
    { title: 'W3C: Understanding SC 3.2.4 Consistent Identification', url: 'https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html' },
    { title: 'W3C: Technique H2, Combining adjacent image and text links for the same resource', url: 'https://www.w3.org/WAI/WCAG22/Techniques/html/H2' },
  ],
  questions: [
    {
      key: 'NAVIGATION', title: 'Navigation', label: 'How do people move around the front end?',
      hint: 'Navigation that stays the same from page to page is learned once; navigation that differs between pages is learned again on each (WCAG 3.2.3, Nielsen\'s consistency and standards).',
      default: 'shared',
      options: [
        { value: 'shared', label: 'one shared navigation on every page', description: 'One navigation component, rendered from one source, with the same links in the same order on every page. Pick it for most applications and sites of up to a few dozen destinations.' },
        { value: 'sections', label: 'a shared global navigation with a navigation per section', description: 'The same global navigation everywhere, and in each section a local navigation that is the same on every page of that section. Pick it for large sites or applications with distinct areas (orders, catalogue, settings), each with several pages of its own.' },
        { value: 'task', label: 'no navigation: a linear journey with a Back link', description: 'A transactional service that takes people through one task a question at a time: the same header on every page, no site navigation, and a Back link to the previous page, as GOV.UK services do. Pick it for forms-based services such as applying, registering or paying.' },
      ],
    },
    {
      key: 'LINK_REPEAT', title: 'Repeated links', label: 'How often may one link target appear in a page\'s main content, outside the navigation and the footer?',
      hint: 'Every repeat is another tab stop and another announcement for screen-reader users, and readers wonder whether two links go to different places. The same page linked five times is the usual symptom.',
      default: 'once',
      options: [
        { value: 'once', label: 'at most once', description: 'Each target is linked once in the main content; a card, list item or table row with an image, a title and a button is one link, and links to different sections of one page count as links to that page. Pick it for applications and most pages.' },
        { value: 'limit', label: 'up to a set limit', description: 'A target may repeat up to the limit set below (for instance a call to action at the top and at the end of a long page). Links to different sections of one page count as links to that page. Pick it for long content or marketing pages, and keep the limit small.' },
      ],
    },
    {
      key: 'LINK_TEXT', title: 'Link names', label: 'How must a link\'s name say where it goes?',
      hint: 'Screen-reader users often list a page\'s links on their own, and everyone scans links: "Read more" five times says nothing (WCAG 2.4.4 and 2.4.9, GOV.UK link guidance).',
      default: 'unique',
      options: [
        { value: 'unique', label: 'a link name that says where it goes on its own', description: 'On a page, one link name never leads to two different targets, and no link is named "click here", "read more" or "more". The level of WCAG 2.4.9 (AAA) and GOV.UK\'s guidance. Pick it for new front ends: it costs nothing when written that way from the start.' },
        { value: 'context', label: 'a link name that says where it goes together with its context', description: 'A name may repeat when its list item, table row, paragraph or card tells the links apart, with the context in visually hidden text where the visible text repeats ("Change" in each row). The level of WCAG 2.4.4 (A). Pick it for dense tables and lists with an action per row.' },
      ],
    },
    {
      key: 'ERRORS', title: 'Form errors', label: 'How do forms show what is wrong?',
      hint: 'Forms are where people give up. An error shown late, vaguely or out of sight costs the whole form; one shown while people are still typing interrupts them (GOV.UK validation pattern, WCAG 3.3.1 and 3.3.3).',
      default: 'summary',
      options: [
        { value: 'summary', label: 'an error summary and a message at each field, on submit (GOV.UK)', description: 'Nothing is checked before the user submits; then the page shows "Error: " in its title, a focused error summary at the top linking to each field in error, and a message at each field. Pick it for forms of more than two or three fields and for public services.' },
        { value: 'field', label: 'a message at each field, on submit', description: 'On submit each field in error shows its message and focus moves to the first of them; no summary. Pick it for short forms (sign-in, search, a single setting) where every field is in view.' },
        { value: 'live', label: 'a message at each field once it is left, and a summary on submit', description: 'A field with a format to check (an IBAN, a password rule) is checked when the user leaves it, never while typing, and on submit the summary appears as well. GOV.UK advises against checking on leaving a field; pick it only where user research shows early feedback saves rework in long or complex forms.' },
      ],
    },
    {
      key: 'EMPTY', title: 'Empty states', label: 'What does a list, table or search with nothing to show say?',
      hint: 'An empty view with no word of explanation looks broken, and a new account sees empty views first (Nielsen\'s visibility of system status; NN/g on empty states).',
      default: 'guided',
      options: [
        { value: 'guided', label: 'an explanation and the next step', description: 'Each empty view says why it is empty and offers the next step as a link or button: create the first item, clear the filters, change the search. Pick it for applications people learn by using, and for anything a new account sees first.' },
        { value: 'plain', label: 'a plain message', description: 'Each empty view says in plain words that there is nothing to show yet, without guidance. Pick it for internal tools whose users know the task and where the next step is always in the same place.' },
      ],
    },
  ],
  details: [
    { key: 'MAX_LINK_REPEATS', label: 'With a set limit: at most how many times may one target be linked in a page\'s main content?', default: '2', number: true },
    { key: 'REVIEW_DAYS', label: 'How often is the heuristic review held (days)?', default: '180', number: true },
  ],
  need: {
    label: 'People find their way and recover from mistakes',
    text: 'People use this front end to get their tasks done, most without training. They must find their way with navigation that stays the same from page to page, links that are neither repeated nor vague (not the same link five times on one page, not five links named "Read more"), forms that say what went wrong and where, and empty views that say why they are empty; and the usability of the whole must be reviewed against recognised principles on a schedule, not only after users complain. The checks assume Playwright tests under tests/ux with tests/ux/journeys.ts listing the main journeys\' pages in the order a user walks them (PAGES: path, and the section where sections have their own navigation), their forms (FORMS: path, the submit button\'s name, the label of one field with a format to check) and the views that start empty for a new account (EMPTY_VIEWS: path); playwright.config sets the baseURL and, for pages behind sign-in, a storageState. Each test fails on its own in a plain run and, run by radical sense playwright, writes what it measured as a radical-metrics/1 file into RADICAL_METRICS_DIR.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-nav-shared', label: 'One navigation on every page', when: { NAVIGATION: ['shared'] }, ears_type: 'ubiquitous',
      action: 'show on every page the same header, navigation and footer, rendered by one shared component, with the same links in the same order under the same names; only the mark of the current page (aria-current="page") differs from page to page',
      rationale: 'Navigation repeated on many pages must come in the same relative order (WCAG 3.2.3, AA) and the same functions must be named the same (3.2.4); it is the first of Nielsen\'s consistency and standards and ISO 9241-110\'s conformity with user expectations.',
      scenario: { label: 'Navigation the same everywhere', given: 'the pages of the main journeys', when: 'the navigation test reads the header, navigation and footer of each', then: 'every page shows the same set, and a page whose navigation differs is named' },
    },
    {
      id: 'req-nav-sections', label: 'Global and section navigation consistent', when: { NAVIGATION: ['sections'] }, ears_type: 'ubiquitous',
      action: 'show on every page the same header, global navigation and footer, and on every page of a section the same section navigation, each with the same links in the same order under the same names; only the mark of the current page (aria-current="page") differs',
      rationale: 'A section\'s own navigation helps in large sites only if it, too, stays put within its section (WCAG 3.2.3 and 3.2.4; Nielsen\'s consistency and standards).',
      scenario: { label: 'Section navigation consistent', given: 'the pages of the main journeys, each with its section', when: 'the navigation test reads the global navigation of every page and the section navigation of each section\'s pages', then: 'the global navigation is the same everywhere and each section\'s navigation is the same on all its pages' },
    },
    {
      id: 'req-nav-task', label: 'Same header and a way back', when: { NAVIGATION: ['task'] }, ears_type: 'ubiquitous',
      action: 'show the same header on every page of the journey, and on every page after the first a Back link to the page before',
      rationale: 'A linear service keeps people on one task, so it needs no site navigation, but people must always be able to step back (GOV.UK back link; Nielsen\'s user control and freedom; ISO 9241-110 controllability).',
      scenario: { label: 'Back on every step', given: 'the pages of the journey in order', when: 'the journey test opens each', then: 'the header is the same on all, and every page after the first has a Back link' },
    },
    {
      id: 'req-link-repeat-once', label: 'Each target linked once', when: { LINK_REPEAT: ['once'] }, ears_type: 'ubiquitous',
      action: 'link to each target at most once in a page\'s main content outside its navigation, a card, list item or table row with several clickable parts being one link',
      rationale: 'GOV.UK: do not "link to the same place constantly throughout your page"; WCAG technique H2 combines an image and a text link to the same place into one. Each repeat adds a tab stop and a screen-reader announcement and makes readers wonder whether the links differ (Nielsen\'s aesthetic and minimalist design).',
      scenario: { label: 'Same link five times caught', given: 'a page whose main content links to the same page in 5 places', when: 'the repeated-links test runs', then: 'it measures ux.links.repeated.max = 5 and fails, naming the page and the target' },
    },
    {
      id: 'req-link-repeat-limit', label: 'Repeated links within the limit', when: { LINK_REPEAT: ['limit'] }, ears_type: 'ubiquitous',
      action: 'link to each target at most {{MAX_LINK_REPEATS}} times in a page\'s main content outside its navigation, a card, list item or table row with several clickable parts being one link',
      rationale: 'A call to action may come back at the end of a long page, but GOV.UK advises against linking "to the same place constantly throughout your page", and each repeat adds a tab stop and a screen-reader announcement (WCAG technique H2).',
      scenario: { label: 'Same link five times caught', given: 'a page whose main content links to the same page in 5 places', when: 'the repeated-links test runs', then: 'it measures ux.links.repeated.max = 5 and fails, since the limit is {{MAX_LINK_REPEATS}}' },
    },
    {
      id: 'req-link-text-unique', label: 'Link names say where they go', when: { LINK_TEXT: ['unique'] }, ears_type: 'ubiquitous',
      action: 'give every link a name that says where it goes on its own: on one page no link name leads to two different targets, and no link is named only "click here", "read more", "more" or the like',
      rationale: 'GOV.UK: "do not reuse the same link text to link to different pages" and avoid "generic text like \'click here\' or \'more\'"; WCAG 2.4.9 (AAA) asks for the purpose from the link alone, which screen-reader users rely on when they list a page\'s links.',
      scenario: { label: 'Vague and ambiguous links caught', given: 'a page with three links named "Read more" to three articles', when: 'the link-names test runs', then: 'it counts one ambiguous name and three vague links and fails' },
    },
    {
      id: 'req-link-text-context', label: 'Link names clear in their context', when: { LINK_TEXT: ['context'] }, ears_type: 'ubiquitous',
      action: 'give every link a name that, with its list item, table row, paragraph or card, says where it goes, so that no two links with the same name in the same context lead to different targets, adding the context in visually hidden text where the visible text repeats',
      rationale: 'WCAG 2.4.4 (A) accepts a link whose purpose is clear from its programmatically determined context; GOV.UK\'s summary lists add visually hidden text to each "Change" link so that it also reads well on its own.',
      scenario: { label: 'Same name in one context caught', given: 'a table row with two links named "View" to different pages', when: 'the link-names test runs', then: 'it counts one name ambiguous in its context and fails' },
    },
    {
      id: 'req-errors-summary', label: 'Errors summarised and shown at each field', when: { ERRORS: ['summary'] }, ears_type: 'event-driven',
      trigger: 'a submitted form has answers that are missing or invalid',
      action: 'show the page again with "Error: " before its title, a focused error summary at the top of the main content linking to each field in error, and at each such field, marked aria-invalid="true", a message tied to it with aria-describedby that says what went wrong and how to fix it; nothing is checked before the user submits',
      rationale: 'The GOV.UK error summary and validation pattern; WCAG 3.3.1 Error Identification and 3.3.3 Error Suggestion; Nielsen\'s help users recognise, diagnose and recover from errors.',
      scenario: { label: 'Empty submit summarised', given: 'a form of the main journeys', when: 'it is submitted empty', then: 'the title starts with "Error: ", focus is on a summary linking every field in error, and each of those fields has its message' },
    },
    {
      id: 'req-errors-field', label: 'Errors shown at each field', when: { ERRORS: ['field'] }, ears_type: 'event-driven',
      trigger: 'a submitted form has answers that are missing or invalid',
      action: 'mark each field in error aria-invalid="true", show at it a message tied to it with aria-describedby that says what went wrong and how to fix it, and move focus to the first field in error',
      rationale: 'In a short form every field is in view, so the message at the field and the focus on the first one are enough (WCAG 3.3.1 and 3.3.3; NN/g error-message guidelines: visible, near the problem, constructive).',
      scenario: { label: 'Empty submit points at the field', given: 'a short form of the main journeys', when: 'it is submitted empty', then: 'each field in error has its message and focus is on the first of them' },
    },
    {
      id: 'req-errors-live', label: 'Errors shown once a field is left', when: { ERRORS: ['live'] }, ears_type: 'event-driven',
      trigger: 'the user leaves a field whose answer has a format to check, or submits the form',
      action: 'show at the field, marked aria-invalid="true", a message tied to it with aria-describedby once the user has left it and never while they are still typing in it, and on submit also show "Error: " before the title and a focused error summary linking to each field in error',
      rationale: 'Early feedback saves rework in long forms only if it never interrupts typing (GOV.UK validation pattern: "avoid validating the information in a field before the user has finished entering it"; WCAG 3.3.1 and 3.3.3).',
      scenario: { label: 'Checked on leaving, not while typing', given: 'a field with a format to check', when: 'one character is typed, then the field is left, then the form is submitted', then: 'no error while typing, the field\'s message after leaving it, and the focused summary after submit' },
    },
    {
      id: 'req-empty-guided', label: 'Empty views explain and offer the next step', when: { EMPTY: ['guided'] }, ears_type: 'event-driven',
      trigger: 'a list, table, search result or dashboard has nothing to show',
      action: 'say in its place why it is empty and offer the next step as a link or button: create the first item, clear the filters or change the search',
      rationale: 'An empty state is where a new user learns what the view is for; one that explains and offers the next step turns a dead end into a start (NN/g, Designing Empty States in Complex Applications; Nielsen\'s visibility of system status).',
      scenario: { label: 'New account sees guidance', given: 'a freshly registered account with no data', when: 'it opens each view that starts empty', then: 'each says why it is empty and offers a link or button to the next step' },
    },
    {
      id: 'req-empty-plain', label: 'Empty views say so', when: { EMPTY: ['plain'] }, ears_type: 'event-driven',
      trigger: 'a list, table, search result or dashboard has nothing to show',
      action: 'say in its place, in plain words, that there is nothing to show yet and why, instead of an empty area or a table of headers only',
      rationale: 'A blank area looks like a failure to load; a sentence tells the user the system works and the view is empty (Nielsen\'s visibility of system status).',
      scenario: { label: 'New account sees a message', given: 'a freshly registered account with no data', when: 'it opens each view that starts empty', then: 'each says in words that there is nothing to show yet' },
    },
    {
      id: 'req-heuristic-review', label: 'Heuristic review on a schedule', ears_type: 'event-driven',
      trigger: '{{REVIEW_DAYS}} days have passed since the last heuristic review, or a major release is planned',
      action: 'have three evaluators each review the main journeys alone against Nielsen\'s ten heuristics and the seven interaction principles of ISO 9241-110, rate each finding on Nielsen\'s severity scale from 0 to 4, and fix every finding rated 3 or 4 before the next release',
      rationale: 'Automated checks cover what can be counted; most usability problems cannot. Three to five evaluators find most of them cheaply (NN/g, How to Conduct a Heuristic Evaluation), and the severity scale decides what must be fixed before release.',
      scenario: { label: 'Review held and acted on', given: 'the date of the last review record', when: '{{REVIEW_DAYS}} days have passed or a major release is planned', then: 'a new record names three evaluators and rates each finding, and every finding rated 3 or 4 has an issue fixed before the release' },
    },
  ],
  adrs: [
    {
      id: 'adr-usability', label: 'Usability held to ISO 9241-110 and Nielsen\'s heuristics',
      decision: 'The front end is held to the seven interaction principles of ISO 9241-110:2020 (suitability for the user\'s tasks, self-descriptiveness, conformity with user expectations, learnability, controllability, use error robustness, user engagement) and to Nielsen\'s ten usability heuristics. What can be counted is measured by Playwright tests over the main journeys on every pull request (navigation, repeated links, link names, form errors, empty views) and written as radical-metrics/1, so the numbers show in the model as well as in the build. What cannot be counted is found by a heuristic review every {{REVIEW_DAYS}} days and before each major release: three evaluators, alone first, findings rated 0 to 4, every 3 or 4 fixed before the release. Empty views: {{EMPTY}}. Navigation, links and form errors are decided in the records below. Accessibility (WCAG 2.2, assistive technology) is decided in the Accessibility pack, and phones and perceived speed in the Mobile and perceived performance pack; this pack refers to them and does not repeat their checks.',
      consequences: '• Consistency becomes a test result, not a matter of taste: a page that drifts fails its pull request.\n• tests/ux/journeys.ts must list the main journeys\' pages, forms and empty views, and be kept up to date as pages are added.\n• The review costs three people about half a day each per cycle; it finds what no test describes.\n• The checks measure markup (landmarks, accessible names, aria-invalid), so they push the front end towards semantic HTML as a side effect.',
      alternatives: '1. Usability testing with users only: finds the real problems, but rarely and expensively; the review and the tests keep the basics between rounds.\n2. A design review on each pull request without measures: depends on who reviews, and nothing shows a drift over time.\n3. Analytics only (drop-off, rage clicks): shows where people struggle, not why, and only after they have.',
    },
    {
      id: 'adr-nav-shared', label: 'One shared navigation on every page', when: { NAVIGATION: ['shared'] },
      decision: 'Every page renders its header, navigation and footer from one shared layout component; pages do not build their own. The navigation is a nav landmark named "Main" (aria-label), lists the top destinations in a fixed order, and marks the current page with aria-current="page". Parts that change on purpose (a basket count, the signed-in name) carry data-ux-varies so the navigation test leaves them out. Links in the main content: decided in the links record ({{LINK_REPEAT}}; {{LINK_TEXT}}).',
      consequences: '• Navigation is learned once and found in the same place on every page (WCAG 3.2.3).\n• A new destination is one change in one component, reviewed with the navigation test.\n• Destinations beyond about seven need grouping or a second level; past that, a navigation per section serves better.',
      alternatives: '1. A shared global navigation with a navigation per section: for large sites with distinct areas.\n2. No navigation, a linear journey: for transactional services.\n3. Navigation built per page: fastest to start, and the drift this record prevents.',
    },
    {
      id: 'adr-nav-sections', label: 'A global navigation and a navigation per section', when: { NAVIGATION: ['sections'] },
      decision: 'Every page renders its header, global navigation (a nav landmark named "Main") and footer from one shared layout component. Each section (as listed in tests/ux/journeys.ts) has its own navigation, a nav landmark named "Section", rendered by one component per section, kept outside the header and the same on every page of the section. Both mark the current page with aria-current="page"; parts that change on purpose carry data-ux-varies. Links in the main content: decided in the links record ({{LINK_REPEAT}}; {{LINK_TEXT}}).',
      consequences: '• Large sites stay navigable: the global navigation stays short, each section shows its own pages.\n• Two levels to keep consistent instead of one; the test checks both.\n• Pages that belong to no section show no section navigation, which the test accepts.',
      alternatives: '1. One shared navigation: simpler, enough up to a few dozen destinations.\n2. A mega menu holding every page: one component, but long and hard to use with a keyboard and on phones.\n3. Navigation built per page: the drift this record prevents.',
    },
    {
      id: 'adr-nav-task', label: 'A linear journey with a Back link', when: { NAVIGATION: ['task'] },
      decision: 'The service takes people through one task, one question or step a page. Every page shows the same header (the service name and, when signed in, a sign-out link) from one shared layout component and no site navigation; every page after the first starts with a Back link (the GOV.UK back link component or its equivalent) to the page before, which keeps what the user entered. A check-your-answers page before the final submit lets people change any answer. Links in the main content: decided in the links record ({{LINK_REPEAT}}; {{LINK_TEXT}}).',
      consequences: '• People are not drawn away from the task, and always have a way back.\n• Moving between parts of the service outside the journey needs a start page or the header, not a navigation.\n• Back must keep the answers, which the journey\'s state handling has to support.',
      alternatives: '1. One shared navigation: for applications people move around freely.\n2. The browser\'s back button only: works, but not every user trusts it in a form, and it may resubmit.',
    },
    {
      id: 'adr-links-once', label: 'Each link target once in the main content', when: { LINK_REPEAT: ['once'] },
      decision: 'In a page\'s main content each target is linked at most once, outside its navigation (breadcrumbs and tables of contents are navigation). A card, list item or table row whose image, title and button go to the same place is one link: the title is the link, and the whole card may be made clickable from it (a pseudo-element stretched over the card), never by wrapping each part in its own link. Link names: {{LINK_TEXT}}. Measured as ux.links.repeated.max on every pull request.',
      consequences: '• Fewer tab stops and announcements; the page reads as it looks.\n• Cards and list items need the stretched-link pattern, written once in the design system.\n• A call to action wanted again at the end of a long page is a button to the same place only if the decision is changed to a set limit.',
      alternatives: '1. Up to a set limit: allows a repeated call to action on long pages.\n2. No rule: the same link five times on one page, which is how this record came about.',
    },
    {
      id: 'adr-links-limit', label: 'Link targets repeated at most a set number of times', when: { LINK_REPEAT: ['limit'] },
      decision: 'In a page\'s main content each target is linked at most {{MAX_LINK_REPEATS}} times, outside its navigation (breadcrumbs and tables of contents are navigation). A card, list item or table row whose image, title and button go to the same place counts as one link and is built as one (the title is the link, stretched over the card). Repeats are for a call to action at the top and the end of a long page, not for every mention. Link names: {{LINK_TEXT}}. Measured as ux.links.repeated.max on every pull request.',
      consequences: '• Long pages may offer their main action again where the reader ends.\n• Each repeat still costs a tab stop; the limit keeps it at {{MAX_LINK_REPEATS}}.\n• Cards and list items need the stretched-link pattern, written once in the design system.',
      alternatives: '1. At most once: the simplest rule, enough for applications.\n2. No rule: the same link five times on one page.',
    },
    {
      id: 'adr-forms-summary', label: 'Form errors: a summary and a message at each field', when: { ERRORS: ['summary'] },
      decision: 'Forms follow the GOV.UK validation pattern: no check before the user submits (novalidate on the form, no live checks); after a failed submit the page shows "Error: " before its title, an error summary at the top of the main content that receives focus and links (#id) to each field in error, and at each such field a message that says what went wrong and how to fix it, tied with aria-describedby, the field marked aria-invalid="true". The server checks every answer; the browser may check the same rules first. Messages are written per field, never "Invalid input".',
      consequences: '• People see all their errors at once, reach each with one link, and screen readers announce the summary.\n• Each form needs a summary component and per-field messages, written once in the design system.\n• Errors appear only on submit, so a long form may hold several at once; the summary is what makes that bearable.',
      alternatives: '1. A message at each field only: enough for short forms.\n2. Checks as each field is left: earlier feedback, at the cost of interrupting people (GOV.UK advises against it).\n3. Native browser validation bubbles: inconsistent across browsers, poorly announced, and gone when the user moves on.',
    },
    {
      id: 'adr-forms-field', label: 'Form errors: a message at each field', when: { ERRORS: ['field'] },
      decision: 'After a failed submit each field in error is marked aria-invalid="true" and shows a message that says what went wrong and how to fix it, tied with aria-describedby, and focus moves to the first field in error. There is no error summary: this holds for forms of up to three fields that are all in view; a longer form follows the GOV.UK summary pattern and needs this record superseded. Nothing is checked before the user submits. The server checks every answer.',
      consequences: '• Short forms stay short: no summary block above two fields.\n• Errors out of view in a longer form would go unnoticed, hence the three-field limit.\n• Each field needs its message slot, written once in the design system.',
      alternatives: '1. A summary and a message at each field: for longer forms.\n2. Checks as each field is left: earlier feedback, more interruptions.',
    },
    {
      id: 'adr-forms-live', label: 'Form errors: checked when a field is left, summarised on submit', when: { ERRORS: ['live'] },
      decision: 'Fields with a format to check (an IBAN, a postcode, a password rule) are checked when the user leaves them, never while typing; the message appears at the field, tied with aria-describedby, the field marked aria-invalid="true", and goes away as soon as the answer is valid. On submit every field is checked and the page shows "Error: " before its title and a focused error summary linking to each field in error, as in the GOV.UK pattern. The reason for checking early is recorded from user research on the form; without it this record is superseded by the summary on submit.',
      consequences: '• People fix a format error while the field is still in mind.\n• Checking on leaving a field interrupts people who skip ahead or come back later; GOV.UK advises against it, so the research that justifies it is kept.\n• Two moments of checking to build and test instead of one.',
      alternatives: '1. A summary and a message at each field, on submit only (GOV.UK).\n2. Checks while typing: the earliest feedback and the most interruptions.',
    },
  ],
  fitness: [
    navigation('shared'),
    navigation('sections'),
    {
      id: 'ff-nav-task', label: 'Same header and a way back', when: { NAVIGATION: ['task'] },
      characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
      implements: ['adr-nav-task'], checks: ['req-nav-task'],
      threshold: 'ux.nav.variants{nav=header} = 1 and ux.back.missing = 0: every page of the journey shows the same header, and every page after the first a visible link named "Back"',
      description: 'A Playwright test opens the pages of the journey in order (PAGES in tests/ux/journeys.ts) and reads the links and buttons of the banner landmark of each (element, name, target path; parts marked data-ux-varies left out). It writes ux.nav.variants{nav=header}, the number of different headers seen, and ux.back.missing, the pages after the first without a visible link named "Back", and fails on either. Bind it with radical sense playwright tests/ux/journey.spec.ts and the conditions ux.nav.variants <= 1 and ux.back.missing <= 0.',
      tool: 'Playwright (@playwright/test), measured by radical sense playwright',
      language: 'ts',
      snippet: `${HEAD('journey.spec.ts', ', type Locator', 'PAGES')}   // the journey's pages in order: [{ path: '/start' }, { path: '/name' }, …]

${WRITE}

/** The links and buttons of a part, in order, by element, name and target path. */
async function itemsOf(part: Locator): Promise<string> {
  if (!(await part.count())) return '(none)'
  return part.first().evaluate((el) => [...el.querySelectorAll<HTMLElement>('a[href], button')]
    .filter((x) => x.checkVisibility() && !x.closest('[data-ux-varies]'))
    .map((x) => [x.tagName, (x.getAttribute('aria-label') ?? x.textContent ?? '').replace(/\\s+/g, ' ').trim(), x instanceof HTMLAnchorElement ? new URL(x.href).pathname : ''].join(' '))
    .join('\\n'))
}

test('every step has the same header and a way back', async ({ page }) => {
  const headers = new Map<string, string[]>()
  const noBack: string[] = []
  for (const [i, { path }] of PAGES.entries()) {
    await page.goto(path)
    const header = await itemsOf(page.getByRole('banner'))
    headers.set(header, [...(headers.get(header) ?? []), path])
    if (i > 0 && !(await page.getByRole('link', { name: 'Back', exact: true }).first().isVisible())) noBack.push(path)
  }
  writeMetrics('journey.json', [
    { metric: 'ux.nav.variants', value: headers.size, labels: { nav: 'header' } },
    { metric: 'ux.back.missing', value: noBack.length },
  ])
  expect.soft(headers.size, \`pages per header: \${JSON.stringify([...headers.values()])}\`).toBe(1)
  expect.soft(noBack, 'steps without a Back link').toEqual([])
})`,
    },
    linksRepeated('once'),
    linksRepeated('limit'),
    linkTexts('unique'),
    linkTexts('context'),
    formErrors('summary'),
    formErrors('field'),
    formErrors('live'),
    emptyStates('guided'),
    emptyStates('plain'),
    {
      id: 'ff-heuristic-review', label: 'Heuristic review held and acted on',
      characteristic: 'interaction-capability', scope: 'holistic', cadence: 'temporal', every: '{{REVIEW_DAYS}}d', invocation: 'manual',
      implements: ['adr-usability'], checks: ['req-heuristic-review'],
      threshold: 'A review record no older than {{REVIEW_DAYS}} days (and one since the last major release), from three evaluators, with every finding rated; 0 findings rated 3 or 4 open at a release',
      description: 'Every {{REVIEW_DAYS}} days, and before each major release, three people (a designer, a developer and someone who knows the users\' work; not the authors of the screens alone) each walk the main journeys alone against the heuristics and principles below, then merge their findings, rate each on Nielsen\'s severity scale (the mean of the three ratings) and file an issue for every finding rated 3 or 4. The record is committed under docs/usability/reviews/, one file per review, named by its date; the release checklist asks for the latest record and for its 3s and 4s to be closed.',
      tool: 'A review record in the repository (Markdown), three evaluators',
      language: 'md',
      snippet: `<!-- docs/usability/reviews/2026-11-24.md: one file per review; the next is due {{REVIEW_DAYS}} days later -->
# Heuristic review, 2026-11-24

Build reviewed: v1.8.0 (commit abc1234)
Journeys: sign up, place an order, change the delivery address
Evaluators, each alone first: A. Designer, B. Developer, C. Support lead

| No. | Where (page, step) | Heuristic or principle | What happens | Severity (mean of 3) | Issue | Fixed in |
|---|---|---|---|---|---|---|
| 1 | /checkout, address | H5 Error prevention; ISO: use error robustness | A typo in the postcode is found only after payment | 3 | #412 | |
| 2 | /orders | H1 Visibility of system status | The list shows nothing while it loads | 2 | #413 | |

Heuristics (Nielsen): H1 Visibility of system status; H2 Match between the system and the real world; H3 User control and freedom; H4 Consistency and standards; H5 Error prevention; H6 Recognition rather than recall; H7 Flexibility and efficiency of use; H8 Aesthetic and minimalist design; H9 Help users recognize, diagnose, and recover from errors; H10 Help and documentation.
Principles (ISO 9241-110:2020): suitability for the user's tasks; self-descriptiveness; conformity with user expectations; learnability; controllability; use error robustness; user engagement.
Severity (Nielsen): 0 not a problem, 1 cosmetic, 2 minor, 3 major (fix before the release), 4 catastrophe (fix before the release).
Outcome: findings rated 3 or 4: 1, all with an issue; release blocked until #412 is closed.`,
    },
  ],
}

export default pack
