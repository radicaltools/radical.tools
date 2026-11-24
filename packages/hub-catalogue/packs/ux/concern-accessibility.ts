import type { FitnessSpec, PackSpec } from '../../src/packSpec'

const FORCES = 'People with disabilities use this web front end with a keyboard, a screen reader, magnification, voice control or switch access, and many more people with a temporary injury, a bright screen or an old phone. The forces: accessibility is a legal duty in the EU (the European Accessibility Act for consumer products and services from 28 June 2025, the Web Accessibility Directive for the public sector, both presuming conformity through EN 301 549 and so WCAG) and in many other markets; it is cheap when built into components and expensive when retrofitted page by page; automated checkers find only part of the failures, so keyboard walks and screen-reader passes are needed for the rest; a failure found late either blocks a release or is shipped with a promise, and promises without a date are forgotten; and an accessibility statement is required of public bodies and expected of everyone, and is only worth something while it is true.'
/** The decisions every fitness function of the pack implements: one per legal frame. */
const SCOPES = ['adr-a11y-eaa', 'adr-a11y-public', 'adr-a11y-internal']

const WRITE = `type Measurement = { metric: string; value: number; unit?: string; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}`

const LEVELS = {
  wcag22aa: { name: 'WCAG 2.2 level AA', tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  aaa: { name: 'WCAG 2.2 level AA and the AAA rules axe automates', tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'wcag2aaa'] },
  wcag21aa: { name: 'WCAG 2.1 level AA', tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
} as const

/** The automated check of one conformance level, failing on every serious
 *  or critical violation, or only on those not tracked to a deadline. */
function axe(level: keyof typeof LEVELS, failures: 'blocking' | 'deadline'): FitnessSpec {
  const { name, tags } = LEVELS[level]
  const tracked = failures === 'deadline'
  const targetSize = (tags as readonly string[]).includes('wcag22aa')
  return {
    id: `ff-axe-${level}${tracked ? '-tracked' : ''}`, label: tracked ? 'No untracked accessibility violations' : 'No accessibility violations', when: { LEVEL: [level], FAILURES: [failures] },
    characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated',
    implements: SCOPES, checks: ['req-conformance', tracked ? 'req-failures-deadline' : 'req-failures-blocking'],
    threshold: tracked
      ? `a11y.violations.untracked = 0: every serious or critical violation of the axe rules tagged ${tags.join(', ')} on the pages and states of the main journeys is listed in tests/a11y/known.json with an issue and a due date`
      : `a11y.violations{impact=critical} = 0 and a11y.violations{impact=serious} = 0 on every page and state of the main journeys, against the axe rules tagged ${tags.join(', ')}`,
    description: `A Playwright test opens each page of the main journeys in each state that matters (STATES in tests/a11y/pages.ts: open dialogs and menus, a form showing its errors, an empty list) and runs axe-core on it with the rules of ${name}. It writes a11y.violations{impact=critical|serious|moderate|minor}, the elements found per impact${tracked ? ', a11y.violations.untracked, the serious and critical violations (rule and state) not listed in tests/a11y/known.json,' : ''} and a11y.states, the states checked (a run that checked none measured nothing), and fails on ${tracked ? 'an untracked serious or critical violation' : 'any serious or critical violation'}, naming the state, rule and elements. ${targetSize ? 'The target-size rule is switched off: target size is decided and measured in the Mobile and perceived performance pack. ' : ''}Automated rules find only part of the failures; the keyboard walk and, where decided, the screen-reader pass cover more. Bind it with radical sense playwright tests/a11y/axe.spec.ts and ${tracked ? 'the condition a11y.violations.untracked <= 0' : 'the conditions a11y.violations{impact=critical} <= 0 and a11y.violations{impact=serious} <= 0'}.`,
    tool: 'axe-core with Playwright (@axe-core/playwright 4.x, @playwright/test), measured by radical sense playwright',
    language: 'ts',
    snippet: `// tests/a11y/axe.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/a11y/axe.spec.ts
import { ${tracked ? 'existsSync, ' : ''}mkdirSync, ${tracked ? 'readFileSync, ' : ''}writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { STATES } from './pages'   // [{ name: 'checkout, address error', path: '/checkout', open: async (page) => { … } }, …]

const TAGS = ${JSON.stringify(tags).replace(/"/g, "'").replace(/,/g, ', ')}   // ${name}${tracked ? `
const KNOWN = 'tests/a11y/known.json'   // [{ rule, state, issue, found, due }]: the violations tracked to a deadline` : ''}

${WRITE}

test('the main journeys meet ${name}', async ({ page }) => {${tracked ? `
  const known: Array<{ rule: string; state: string }> = existsSync(KNOWN) ? JSON.parse(readFileSync(KNOWN, 'utf8')) : []` : ''}
  const byImpact: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const failing: string[] = []
  for (const state of STATES) {
    await page.goto(state.path)
    await state.open?.(page)
    const { violations } = await new AxeBuilder({ page })
      .withTags(TAGS)${targetSize ? `
      .disableRules(['target-size'])   // decided and measured in the Mobile and perceived performance pack` : ''}
      .analyze()
    for (const v of violations) {
      byImpact[v.impact ?? 'minor'] += v.nodes.length
      if (v.impact !== 'serious' && v.impact !== 'critical') continue${tracked ? `
      if (known.some((k) => k.rule === v.id && k.state === state.name)) continue` : ''}
      failing.push(\`\${state.name}: \${v.id} (\${v.impact}) at \${v.nodes.map((n) => n.target.join(' ')).join(', ')}\`)
    }
  }
  writeMetrics('axe.json', [
    ...Object.entries(byImpact).map(([impact, value]) => ({ metric: 'a11y.violations', value, labels: { impact } })),${tracked ? `
    { metric: 'a11y.violations.untracked', value: failing.length },` : ''}
    { metric: 'a11y.states', value: STATES.length },
  ])
  expect(failing, 'serious and critical violations${tracked ? ' not in tests/a11y/known.json' : ''}').toEqual([])
})`,
  }
}

const pack: PackSpec = {
  id: 'concern-accessibility',
  name: 'Accessibility',
  group: 'ux',
  description: 'Whether everyone can use the web front end, people with disabilities and assistive technology included: the WCAG level it conforms to, the law it answers to (European Accessibility Act, Web Accessibility Directive), how it is tested, the accessibility statement, and what a failure found does to a change.',
  tags: ['ux', 'accessibility', 'wcag', 'wcag 2.2', 'en 301 549', 'european accessibility act', 'axe-core', 'screen reader', 'keyboard'],
  concern: {
    id: 'accessibility',
    trigger: 'LIST RELATIONS WHERE source.type = "person" AND target.type = "webapp" AND target.external != true',
    applyTo: 'target',
    why: 'people use these web front ends, so the accessibility level they conform to, the law they answer to, and how that is tested and stated has to be decided.',
  },
  sources: [
    { title: 'W3C: Web Content Accessibility Guidelines (WCAG) 2.2', url: 'https://www.w3.org/TR/WCAG22/' },
    { title: 'ETSI EN 301 549 V3.2.1: Accessibility requirements for ICT products and services', url: 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf' },
    { title: 'Directive (EU) 2019/882, the European Accessibility Act', url: 'https://eur-lex.europa.eu/eli/dir/2019/882/oj' },
    { title: 'Directive (EU) 2016/2102, the Web Accessibility Directive', url: 'https://eur-lex.europa.eu/eli/dir/2016/2102/oj' },
    { title: 'Commission Implementing Decision (EU) 2018/1523, the model accessibility statement', url: 'https://eur-lex.europa.eu/eli/dec_impl/2018/1523/oj' },
    { title: 'W3C WAI: Developing an Accessibility Statement', url: 'https://www.w3.org/WAI/planning/statements/' },
    { title: 'W3C WAI: Evaluating Web Accessibility Overview', url: 'https://www.w3.org/WAI/test-evaluate/' },
    { title: 'W3C: Understanding SC 2.4.11 Focus Not Obscured (Minimum)', url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html' },
    { title: 'axe-core: API, rule tags', url: 'https://github.com/dequelabs/axe-core/blob/develop/doc/API.md' },
    { title: '@axe-core/playwright', url: 'https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright' },
    { title: 'Playwright: Accessibility testing', url: 'https://playwright.dev/docs/accessibility-testing' },
  ],
  questions: [
    {
      key: 'LEVEL', title: 'Conformance', label: 'Which level must the front end conform to?',
      hint: 'The level decides which success criteria apply and which automated rules run. EN 301 549, and through it the European Accessibility Act and the Web Accessibility Directive, rests on WCAG level AA.',
      default: 'wcag22aa',
      options: [
        { value: 'wcag22aa', label: 'WCAG 2.2 level AA', description: 'The current W3C recommendation. It includes everything of 2.1 AA, so it also meets EN 301 549 V3.2.1, which points at 2.1 AA, and adds focus not obscured, dragging alternatives, consistent help and accessible authentication. Pick it for every new front end.' },
        { value: 'aaa', label: 'WCAG 2.2 level AA, and level AAA where feasible', description: 'AA, plus the AAA criteria taken on one by one where the content allows (enhanced contrast of 7:1, link purpose from the link alone, no timing), with the automated AAA rules switched on. W3C does not advise AAA as a policy for whole sites. Pick it for services used mostly by older people or people with low vision or cognitive disabilities, or when a contract asks for it.' },
        { value: 'wcag21aa', label: 'WCAG 2.1 level AA', description: 'The level EN 301 549 V3.2.1 names today, without the nine criteria 2.2 added. Pick it only for an existing front end being brought up to standard, with a dated plan to move to 2.2.' },
      ],
    },
    {
      key: 'SCOPE', title: 'Legal frame', label: 'Which accessibility law does the front end answer to?',
      hint: 'The law decides who may enforce it, what must be published, and which exemptions exist. The level above is the technical answer to each of them.',
      default: 'eaa',
      options: [
        { value: 'eaa', label: 'the European Accessibility Act', description: 'A consumer product or service offered in the EU (online shops, consumer banking, e-books, passenger transport, electronic communications), from 28 June 2025. Microenterprises that provide services are exempt. Pick it for anything sold or offered to consumers in the EU.' },
        { value: 'public', label: 'the Web Accessibility Directive', description: 'A website or app of a public-sector body in the EU: national, regional and local authorities and bodies governed by public law. It requires a published accessibility statement with a feedback mechanism. Pick it for public services.' },
        { value: 'internal', label: 'no accessibility law of its own (an internal tool)', description: 'A tool used only by the organisation\'s own staff. No product law applies, but employment equality law (Directive 2000/78/EC) asks for reasonable accommodation of employees with disabilities, and a tool that excludes them has to be replaced or worked around. Pick it for back-office and internal tools.' },
      ],
    },
    {
      key: 'AT_TESTING', title: 'Assistive technology', label: 'Is the front end tested with assistive technology?',
      hint: 'Automated rules find only part of the failures: whether a screen reader announces a control sensibly, or a journey makes sense without sight, takes a person.',
      default: 'manual',
      options: [
        { value: 'manual', label: 'a screen-reader pass before each release (NVDA and VoiceOver)', description: 'Before each release candidate is released, someone completes the main journeys with NVDA on Windows and VoiceOver on macOS and iOS and records the pass. Pick it for public services, consumer products, and anything with complex widgets (date pickers, comboboxes, drag and drop).' },
        { value: 'automated', label: 'automated checks only', description: 'axe-core and the keyboard walk on every pull request, and no screen-reader pass. Pick it for internal tools built entirely from a tested accessible component library, and record the risk.' },
      ],
    },
    {
      key: 'STATEMENT', title: 'Statement', label: 'Is an accessibility statement published?',
      hint: 'A statement tells users how accessible the front end is, what is not and what to do instead, and how to report a problem. Public bodies must publish one; the European Accessibility Act asks service providers to make the same information available.',
      default: 'published',
      options: [
        { value: 'published', label: 'an accessibility statement, published and kept current', description: 'A statement after the EU model, linked from every page\'s footer, reviewed at least once a year. Pick it always for the public sector, and for consumer services under the European Accessibility Act.' },
        { value: 'none', label: 'no accessibility statement', description: 'Nothing is published. Pick it only for internal tools, where staff reach the team directly; not with the Web Accessibility Directive, which requires a statement.' },
      ],
    },
    {
      key: 'FAILURES', title: 'Failures', label: 'What does a serious or critical violation found by the automated checks do?',
      hint: 'Blocking keeps the front end clean but can stop a release for a third-party widget; tracking lets work go on, and only works with a deadline someone checks.',
      default: 'blocking',
      options: [
        { value: 'blocking', label: 'it blocks the change until it is fixed', description: 'A serious or critical violation fails the pull request; there is no list of accepted violations. Pick it for new front ends and wherever the components are your own.' },
        { value: 'deadline', label: 'it is tracked and fixed within a set number of days', description: 'A violation that cannot be fixed in the change is listed with an issue and a due date within the days set below; the build fails on any violation not listed, and a nightly check fails once a due date has passed. Pick it for an existing front end being brought up to standard, or one with third-party widgets you cannot change at once.' },
      ],
    },
  ],
  details: [
    { key: 'FIX_DAYS', label: 'With tracking: within how many days must a tracked violation be fixed?', default: '30', number: true },
  ],
  need: {
    label: 'Everyone can use it',
    text: 'People with disabilities use this front end with a keyboard, a screen reader, magnification or voice control, and the law may require that they can. Every function of the main journeys must work for them, to a WCAG level that is decided and checked on every change, with what automated checks cannot see tested by people, what is not yet accessible stated openly, and failures fixed on a schedule rather than when someone complains. The checks assume Playwright tests under tests/a11y with tests/a11y/pages.ts listing the pages of the main journeys (PAGES: path) and the states worth checking (STATES: a name, a path and, where needed, the steps that open a dialog, show a form\'s errors or empty a list); playwright.config sets the baseURL and, for pages behind sign-in, a storageState. Each test fails on its own in a plain run and, run by radical sense playwright, writes what it measured as a radical-metrics/1 file into RADICAL_METRICS_DIR.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-conformance', label: 'Conforms to the chosen WCAG level', ears_type: 'ubiquitous',
      action: 'conform to {{LEVEL}} on every page of the main journeys and in each of their states (open dialogs and menus, error messages, empty and loading states); a serious or critical violation found by the automated checks is handled as decided: {{FAILURES}}',
      rationale: 'WCAG level AA is what EN 301 549 requires and so what the European Accessibility Act and the Web Accessibility Directive presume conformity by (W3C WCAG 2.2; EN 301 549 clause 9). Dialogs and error states are where automated checks most often find failures, so they are checked as states, not only pages. Reflow and target size are decided and measured in the Mobile and perceived performance pack; link purpose, consistent navigation and how form errors are shown in the Usability pack.',
      scenario: { label: 'Page passes accessibility checks', given: 'each page of the main journeys in each listed state', when: 'the automated checks run', then: 'no serious or critical violation is reported that is not handled as decided' },
    },
    {
      id: 'req-keyboard', label: 'Operable by keyboard alone', ears_type: 'ubiquitous',
      action: 'let every function of the main journeys be operated with the keyboard alone, with no keyboard trap, a visible focus indicator on every focused control, and no focused control entirely hidden by sticky headers, footers or other content',
      rationale: 'Keyboard access is what screen readers, switch access and voice control build on (WCAG 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured (Minimum), new in 2.2). Automated rules cannot walk a journey, so a test does.',
      scenario: { label: 'Main journey by keyboard', given: 'the main journey', when: 'it is walked with Tab, Shift+Tab, Enter, Space and the arrow keys only', then: 'every step is reached and completed, and focus is visible and not hidden at every step' },
    },
    {
      id: 'req-at-manual', label: 'Screen-reader pass before release', when: { AT_TESTING: ['manual'] }, ears_type: 'event-driven',
      trigger: 'a release candidate is built',
      action: 'complete the main journeys with NVDA and Firefox or Chrome on Windows and with VoiceOver and Safari on macOS and iOS, record the pass, and fix every blocker found before the candidate is released',
      rationale: 'Whether a control is announced with a sensible name, role and state, and whether a journey makes sense without sight, only a person with the assistive technology can tell (W3C WAI, Evaluating Web Accessibility). NVDA and VoiceOver with those browsers are the most used free combinations.',
      scenario: { label: 'Journeys completed with screen readers', given: 'a release candidate', when: 'the main journeys are walked with NVDA on Windows and VoiceOver on macOS and iOS', then: 'the pass is recorded, and the candidate is released only with no open blocker' },
    },
    {
      id: 'req-statement', label: 'Accessibility statement published and current', when: { STATEMENT: ['published'] }, ears_type: 'ubiquitous',
      action: 'publish an accessibility statement, linked from the footer of every page, that states the conformance status against {{LEVEL}}, the content that is not accessible with the reason and the alternative, how to report a problem or ask for content in another form, the enforcement procedure, and the date of its last review, reviewed at least once every 365 days',
      rationale: 'The Web Accessibility Directive (Article 7) requires a statement after the model of Implementing Decision (EU) 2018/1523, with a feedback mechanism and a link to the enforcement procedure; the European Accessibility Act (Annex V) asks service providers to make the same information available; a statement is only worth something while it is current (W3C WAI, Developing an Accessibility Statement).',
      scenario: { label: 'Statement linked and current', given: 'the pages of the main journeys and the statement', when: 'the statement test runs', then: 'every page links the statement from its footer, the statement has each required section, and its last review is at most 365 days old' },
    },
    {
      id: 'req-failures-blocking', label: 'Violations block the change', when: { FAILURES: ['blocking'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a change brings a serious or critical violation found by the automated checks',
      action: 'refuse to merge the change until the violation is fixed, keeping no list of accepted violations',
      rationale: 'A violation fixed in the change that brought it costs minutes; one shipped is found by a user, or by an enforcement body (W3C WAI, Evaluating Web Accessibility).',
      scenario: { label: 'Violation blocks the merge', given: 'a pull request that adds an image button without an accessible name', when: 'the automated checks run', then: 'the check fails, naming the state, the rule and the element, and the pull request cannot be merged' },
    },
    {
      id: 'req-failures-deadline', label: 'Violations fixed by a deadline', when: { FAILURES: ['deadline'] }, ears_type: 'event-driven',
      trigger: 'a serious or critical violation found by the automated checks cannot be fixed in the change that finds it',
      action: 'record it in tests/a11y/known.json with its rule, the state it appears in, an issue and a due date at most {{FIX_DAYS}} days after it was found, and fail the nightly check once the due date has passed',
      rationale: 'An existing front end or a third-party widget may not be fixable at once; a list with issues and due dates keeps the debt visible and bounded, and the statement can name it as content not yet accessible.',
      scenario: { label: 'Overdue violation fails the night', given: 'a tracked violation whose due date has passed', when: 'the nightly check runs', then: 'it fails, naming the violation and its issue' },
    },
  ],
  adrs: [
    {
      id: 'adr-a11y-eaa', label: 'Accessible under the European Accessibility Act', when: { SCOPE: ['eaa'] },
      decision: 'The front end is a consumer service under the European Accessibility Act (Directive (EU) 2019/882, applying from 28 June 2025) and conforms to {{LEVEL}}, the technical basis of EN 301 549, the harmonised standard that presumes conformity. Every page and state of the main journeys is checked by axe-core and walked with the keyboard on every pull request; assistive technology: {{AT_TESTING}}; a serious or critical violation found: {{FAILURES}}. Statement: {{STATEMENT}}; Annex V asks for the information on how the service meets the requirements in the terms and conditions or another public place, so the statement is the place it is kept. A claim that a requirement would be a disproportionate burden (Article 14) is assessed and documented before it is relied on, never assumed. Reflow and target size are decided and measured in the Mobile and perceived performance pack; link purpose, consistent navigation and how form errors are shown in the Usability pack.',
      consequences: '• Market surveillance authorities can act on a complaint; the checks and the statement are the evidence of conformity.\n• Accessible components are built once in the design system and reused, which is where most of the cost goes.\n• Third-party widgets (payment, chat, maps) must meet the level too, so their accessibility is part of choosing them.\n• Content that is not yet accessible is stated, with an alternative, rather than hidden.',
      alternatives: '1. Accessibility only where a complaint arrives: cheaper at first, and a legal risk from June 2025.\n2. An overlay widget that claims to fix accessibility at run time: does not make the front end conform, and is criticised by disabled users.\n3. A separate accessible version of the site: falls behind the main one and is not equal treatment.',
    },
    {
      id: 'adr-a11y-public', label: 'Accessible under the Web Accessibility Directive', when: { SCOPE: ['public'] },
      decision: 'The front end belongs to a public-sector body under the Web Accessibility Directive (Directive (EU) 2016/2102) and conforms to {{LEVEL}}, the technical basis of EN 301 549. Every page and state of the main journeys is checked by axe-core and walked with the keyboard on every pull request; assistive technology: {{AT_TESTING}}; a serious or critical violation found: {{FAILURES}}. Statement: {{STATEMENT}}; the Directive (Article 7) requires one after the model of Implementing Decision (EU) 2018/1523, with a feedback mechanism people use to report problems and ask for content in another form, and a link to the enforcement procedure, so a statement is not optional here. Reflow and target size are decided and measured in the Mobile and perceived performance pack; link purpose, consistent navigation and how form errors are shown in the Usability pack.',
      consequences: '• The national monitoring body checks samples of public sites and apps; the checks and the statement are what it reads.\n• The feedback mechanism needs someone who answers, with the response time the member state sets.\n• Content exempt under the Directive (older office files, third-party content not under the body\'s control) is listed in the statement, not left unsaid.',
      alternatives: '1. Accessibility only where a complaint arrives: does not meet the Directive.\n2. An overlay widget: does not make the front end conform.\n3. A separate accessible version: falls behind and is not equal treatment.',
    },
    {
      id: 'adr-a11y-internal', label: 'An internal tool usable by every employee', when: { SCOPE: ['internal'] },
      decision: 'The front end is an internal tool, outside the European Accessibility Act and the Web Accessibility Directive, and still conforms to {{LEVEL}}: employment equality law (Directive 2000/78/EC, Article 5) asks for reasonable accommodation of employees with disabilities, and a tool that one employee cannot use has to be fixed or worked around at a worse moment. Every page and state of the main journeys is checked by axe-core and walked with the keyboard on every pull request; assistive technology: {{AT_TESTING}}; a serious or critical violation found: {{FAILURES}}. Statement: {{STATEMENT}}. Reflow and target size are decided and measured in the Mobile and perceived performance pack; link purpose, consistent navigation and how form errors are shown in the Usability pack.',
      consequences: '• No regulator, but the same level: a new colleague with a disability can start on day one.\n• The same accessible components serve internal and public front ends alike.\n• Should the tool later be offered to customers, it is already at the level the Act asks for.',
      alternatives: '1. Accessibility on request, when an employee needs it: a retrofit under time pressure, for one person who waits.\n2. A lower level (WCAG level A): fewer checks, and keyboard and contrast failures that affect many more people than screen-reader users.',
    },
  ],
  fitness: [
    axe('wcag22aa', 'blocking'),
    axe('wcag22aa', 'deadline'),
    axe('aaa', 'blocking'),
    axe('aaa', 'deadline'),
    axe('wcag21aa', 'blocking'),
    axe('wcag21aa', 'deadline'),
    {
      id: 'ff-keyboard', label: 'Main journey by keyboard', characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: SCOPES, checks: ['req-keyboard'],
      threshold: 'a11y.keyboard.unreachable = 0, a11y.focus.invisible = 0 and a11y.focus.obscured = 0: the main journey completes with the keyboard alone, every step is reached with Tab within 200 presses, and every focused control shows a focus indicator and is not entirely hidden',
      description: 'A Playwright test walks the main journey without the mouse: for each step it presses Tab until the control (found by its role and accessible name) has focus, checks that the focused control shows an outline or a box shadow and that something of it can be seen (at its centre or one of its corners nothing else is drawn on top), then types and presses Enter or Space as the step says. A control not reached within 200 presses (a missing tabindex, or focus caught in a trap) ends the walk. It writes a11y.keyboard.unreachable, a11y.focus.invisible and a11y.focus.obscured and fails on any. A control that shows its focus on another element (a custom checkbox styled through its label) needs its own check in focusState. Bind it with radical sense playwright tests/a11y/keyboard.spec.ts and the conditions a11y.keyboard.unreachable <= 0, a11y.focus.invisible <= 0 and a11y.focus.obscured <= 0.',
      tool: 'Playwright (@playwright/test), measured by radical sense playwright',
      language: 'ts',
      snippet: `// tests/a11y/keyboard.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/a11y/keyboard.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'

/** A step of the journey: the control by its role and accessible name, what to type, and the key that activates it. */
type Step = { role: Parameters<Page['getByRole']>[0]; name: string; type?: string; key?: 'Enter' | 'Space' }
const JOURNEY: Step[] = [
  { role: 'searchbox', name: 'Search', type: 'trail shoes', key: 'Enter' },
  { role: 'link', name: 'Trail runner 2', key: 'Enter' },
  { role: 'button', name: 'Add to basket', key: 'Enter' },
  { role: 'link', name: 'Checkout', key: 'Enter' },
  { role: 'checkbox', name: 'I accept the terms', key: 'Space' },
  { role: 'button', name: 'Place order', key: 'Enter' },
]
const DONE = 'Order placed'   // the heading the journey ends on
const MAX_TABS = 200

${WRITE}

/** Presses Tab until the control has focus; false when it is not reached within MAX_TABS presses. */
async function tabTo(page: Page, target: Locator): Promise<boolean> {
  for (let i = 0; i <= MAX_TABS; i++) {
    if (await target.evaluateAll((els) => els.some((el) => el === document.activeElement))) return true
    await page.keyboard.press('Tab')
  }
  return false
}

/** Whether the focused control shows a focus indicator, and whether it is entirely hidden by something drawn over it. */
const focusState = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement
  const style = getComputedStyle(el)
  const indicated = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
  const r = el.getBoundingClientRect()
  const hits = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y))
  return { indicated, hidden: hits.every((hit) => !hit || !(hit === el || el.contains(hit))) }
})

test('the main journey completes with the keyboard alone', async ({ page }) => {
  const unreachable: string[] = [], invisible: string[] = [], obscured: string[] = []
  await page.goto('/')
  for (const step of JOURNEY) {
    if (!(await tabTo(page, page.getByRole(step.role, { name: step.name, exact: true })))) { unreachable.push(step.name); break }
    const focus = await focusState(page)
    if (!focus.indicated) invisible.push(step.name)
    if (focus.hidden) obscured.push(step.name)
    if (step.type) await page.keyboard.type(step.type)
    if (step.key) await page.keyboard.press(step.key)
  }
  writeMetrics('keyboard.json', [
    { metric: 'a11y.keyboard.unreachable', value: unreachable.length },
    { metric: 'a11y.focus.invisible', value: invisible.length },
    { metric: 'a11y.focus.obscured', value: obscured.length },
  ])
  expect.soft(unreachable, 'not reached with Tab: a missing tabindex, or focus caught in a trap').toEqual([])
  expect.soft(invisible, 'focused without a visible indicator').toEqual([])
  expect.soft(obscured, 'focused under a sticky header, footer or dialog').toEqual([])
  if (!unreachable.length) await expect(page.getByRole('heading', { name: DONE })).toBeVisible()
})`,
    },
    {
      id: 'ff-screen-reader', label: 'Screen-reader pass recorded', when: { AT_TESTING: ['manual'] }, characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'release', invocation: 'manual', implements: SCOPES, checks: ['req-at-manual'],
      threshold: 'One pass record per release candidate covering every main journey with NVDA on Windows and VoiceOver on macOS and iOS; 0 open blockers when the candidate is released',
      description: 'Before a release candidate is released, a tester who uses screen readers regularly walks every main journey with each combination, ticks the checklist and records each blocker as an issue. The record is committed under docs/accessibility/at-passes/, one file per release; the release checklist asks for it and for its blockers to be closed. Where a combination is not available in-house, an external accessibility tester or a user panel takes it.',
      tool: 'NVDA with Firefox or Chrome (Windows), VoiceOver with Safari (macOS and iOS); a pass record in the repository (Markdown)',
      language: 'md',
      snippet: `<!-- docs/accessibility/at-passes/v1.8.0.md: one file per release candidate, before it is released -->
# Assistive technology pass, release v1.8.0

Tester: B. Tester, 2026-11-24

| Journey | NVDA + Firefox or Chrome (Windows) | VoiceOver + Safari (macOS) | VoiceOver + Safari (iOS) | Blockers |
|---|---|---|---|---|
| Sign up | completed | completed | completed | |
| Place an order | completed | blocked: the delivery date picker announces no dates | completed | #418 |

Checked on every journey, with each combination:
- [ ] it completes without sight of the screen
- [ ] headings and landmarks give the page's structure; the page title names the page
- [ ] every control announces its name, role and state (expanded, selected, checked)
- [ ] errors and status messages are announced without moving focus away (WCAG 4.1.3)
- [ ] dialogs take focus, keep it inside while open, and return it to the control that opened them
- [ ] images that carry meaning are described; decorative ones are silent
- [ ] at 200% browser zoom and in Windows contrast themes (forced colours) the journey still completes

Outcome: 1 blocker; the release waits until #418 is closed.`,
    },
    {
      id: 'ff-statement', label: 'Statement linked and current', when: { STATEMENT: ['published'] }, characteristic: 'interaction-capability', scope: 'holistic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: SCOPES, checks: ['req-statement'],
      threshold: 'a11y.statement.unlinked = 0, a11y.statement.missing = 0 and a11y.statement.age <= 365 d: every page of the main journeys links the statement from its footer, the statement has each required section and the date of its last review, and that date is at most 365 days old',
      description: 'A nightly Playwright test (nightly because the statement ages without any change) opens every page of the main journeys and looks for the statement link in the footer (contentinfo landmark), then opens the statement and looks for each required heading and for a <time datetime> in the paragraph that says when it was last reviewed. It writes a11y.statement.unlinked, the pages without the link, a11y.statement.missing, the sections or review date missing, and a11y.statement.age, the days since the last review, and fails on any page without the link, a missing section, or a review older than 365 days. SECTIONS are the headings of the EU model statement; a statement under the European Accessibility Act or for an internal tool lists its own. Bind it with radical sense playwright tests/a11y/statement.spec.ts and the conditions a11y.statement.unlinked <= 0, a11y.statement.missing <= 0 and a11y.statement.age <= 365 d.',
      tool: 'Playwright (@playwright/test), measured by radical sense playwright',
      language: 'ts',
      snippet: `// tests/a11y/statement.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/a11y/statement.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { PAGES } from './pages'   // [{ path: '/' }, { path: '/checkout' }, …]: the main journeys' pages

const LINK = 'Accessibility statement'   // the footer link's name
const STATEMENT = '/accessibility'
// The headings of the EU model statement (Implementing Decision (EU) 2018/1523)
const SECTIONS = ['Compliance status', 'Non-accessible content', 'Preparation of this accessibility statement', 'Feedback and contact information', 'Enforcement procedure']
const MAX_AGE_DAYS = 365

${WRITE}

test('the accessibility statement is linked from every page and current', async ({ page }) => {
  const unlinked: string[] = []
  for (const { path } of PAGES) {
    await page.goto(path)
    if (!(await page.getByRole('contentinfo').getByRole('link', { name: LINK }).count())) unlinked.push(path)
  }
  await page.goto(STATEMENT)
  const missing: string[] = []
  for (const name of SECTIONS) if (!(await page.getByRole('heading', { name }).count())) missing.push(name)
  // "This statement was last reviewed on <time datetime="2026-09-30">30 September 2026</time>."
  const reviewed = await page.locator('main p', { hasText: /last reviewed/i }).locator('time[datetime]').first()
    .getAttribute('datetime', { timeout: 2_000 }).catch(() => null)
  const age = reviewed ? Math.floor((Date.now() - Date.parse(reviewed)) / 86_400_000) : null
  if (age === null || Number.isNaN(age)) missing.push('the date of the last review')
  writeMetrics('statement.json', [
    { metric: 'a11y.statement.unlinked', value: unlinked.length },
    { metric: 'a11y.statement.missing', value: missing.length },
    ...(age !== null && !Number.isNaN(age) ? [{ metric: 'a11y.statement.age', value: age, unit: 'd' }] : []),
  ])
  expect.soft(unlinked, 'pages without the statement in their footer').toEqual([])
  expect.soft(missing, 'missing from the statement').toEqual([])
  expect.soft(age ?? Infinity, 'days since the statement was last reviewed').toBeLessThanOrEqual(MAX_AGE_DAYS)
})`,
    },
    {
      id: 'ff-a11y-deadlines', label: 'Tracked violations fixed in time', when: { FAILURES: ['deadline'] }, characteristic: 'interaction-capability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: SCOPES, checks: ['req-failures-deadline'],
      threshold: 'a11y.known.overdue = 0, a11y.known.too_late = 0 and a11y.known.no_issue = 0: no tracked violation is past its due date, none is due more than {{FIX_DAYS}} days after it was found, and every one names an issue',
      description: 'A nightly job reads tests/a11y/known.json, the list the axe check accepts, and counts the entries past their due date, those due more than {{FIX_DAYS}} days after they were found, and those without an issue; it writes the counts to reports/a11y-known.json and fails on any, printing the entries concerned. A fixed violation is taken off the list in the change that fixes it; the axe check then fails if it comes back. Bind it with radical sense json reports/a11y-known.json --metric a11y.known.overdue=overdue --metric a11y.known.too_late=too_late --metric a11y.known.no_issue=no_issue --metric a11y.known.open=open, and the conditions a11y.known.overdue <= 0, a11y.known.too_late <= 0 and a11y.known.no_issue <= 0. Runs on Linux or macOS (jq 1.6 or later).',
      tool: 'jq in a scheduled CI job, measured by radical sense json',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# Nightly: the accessibility violations tracked in tests/a11y/known.json, e.g.
#   [{ "rule": "color-contrast", "state": "checkout", "issue": "https://example.org/issues/412", "found": "2026-11-02", "due": "2026-12-02" }]
set -euo pipefail
known=tests/a11y/known.json
fix_days={{FIX_DAYS}}
mkdir -p reports
[ -f "$known" ] || { echo '{"open":0,"overdue":0,"too_late":0,"no_issue":0}' > reports/a11y-known.json; exit 0; }
jq --arg today "$(date -u +%F)" --argjson days "$fix_days" '
  def day: strptime("%Y-%m-%d") | mktime;
  { open: length,
    overdue: [.[] | select(.due < $today)] | length,
    too_late: [.[] | select((.due | day) - (.found | day) > $days * 86400)] | length,
    no_issue: [.[] | select((.issue // "") == "")] | length,
    entries: [.[] | select(.due < $today or (.issue // "") == "")] }' "$known" > reports/a11y-known.json
jq -e '.overdue == 0 and .too_late == 0 and .no_issue == 0' reports/a11y-known.json > /dev/null || {
  jq . reports/a11y-known.json
  echo "::error::tracked accessibility violations past their due date, due more than $fix_days days after found, or without an issue"
  exit 1
}`,
    },
  ],
}

export default pack
