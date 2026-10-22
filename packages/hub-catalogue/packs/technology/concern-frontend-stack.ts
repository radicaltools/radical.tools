import type { PackSpec } from '../../src/packSpec'

const FRAMEWORKS = ['adr-react', 'adr-angular', 'adr-vue', 'adr-svelte', 'adr-htmx']
const FORCES = 'This element is a web front end that people use in their own browsers, on their own devices and networks. The forces: every kilobyte of JavaScript is downloaded, parsed and run on the user\'s phone, and mid-range phones on mobile networks are where most budgets break; search engines and first visits reward content in the first HTML response, while app-like screens favour rendering in the browser; a framework brings its ecosystem, hiring pool and release cadence, and its majors reach end of support on published dates; a shared design system keeps screens consistent and accessible, but costs effort to build and keep; the browsers to support decide which features and polyfills ship; and accessibility is a legal duty in many markets (European Accessibility Act, ADA, Section 508), cheap when built in and expensive when retrofitted.'

const pack: PackSpec = {
  id: 'concern-frontend-stack',
  name: 'Frontend stack',
  group: 'technology',
  description: 'The UI framework and rendering model of a web front end, its design system, the browsers it supports, its performance budget (Core Web Vitals, JavaScript size) and its accessibility level.',
  tags: ['technology', 'frontend', 'web', 'framework', 'core web vitals', 'accessibility', 'design system', 'browser support'],
  concern: {
    id: 'frontend-stack',
    trigger: 'LIST NODES WHERE type = "webapp" AND external != true',
    why: 'these are web front ends, so what they are built with, how they render, how fast and accessible they must be, and which browsers they support has to be decided.',
  },
  sources: [
    { title: 'web.dev: Web Vitals (LCP, INP, CLS and their thresholds)', url: 'https://web.dev/articles/vitals' },
    { title: 'W3C: Web Content Accessibility Guidelines (WCAG) 2.2', url: 'https://www.w3.org/TR/WCAG22/' },
    { title: 'Browserslist', url: 'https://github.com/browserslist/browserslist' },
    { title: 'endoflife.date: framework support lifecycles', url: 'https://endoflife.date/' },
    { title: 'Lighthouse CI', url: 'https://github.com/GoogleChrome/lighthouse-ci' },
    { title: 'axe-core', url: 'https://github.com/dequelabs/axe-core' },
    { title: 'Thoughtworks Technology Radar', url: 'https://www.thoughtworks.com/radar' },
  ],
  questions: [
    {
      key: 'FRAMEWORK', title: 'Framework', label: 'What is the front end built with?',
      hint: 'The framework brings its ecosystem, its way of rendering and the people who can work on it. Changing it later means rewriting the front end.',
      default: 'react',
      options: [
        { value: 'react', label: 'React (Next.js or Vite)', description: 'The largest ecosystem and hiring pool; Next.js for server rendering and static pages, Vite for a plain single-page app. Pick it when the team knows React, or you need the widest choice of components and libraries.' },
        { value: 'angular', label: 'Angular', description: 'One opinionated framework with routing, forms, HTTP and testing included, and a published support schedule per major. Pick it for large business applications built by several teams that value one way of doing things, or where the team already knows it.' },
        { value: 'vue', label: 'Vue (Nuxt or Vite)', description: 'Approachable, with single-file components; Nuxt for server rendering and static pages. Pick it when the team knows Vue, or it is adopted gradually into existing server-rendered pages.' },
        { value: 'svelte', label: 'Svelte (SvelteKit)', description: 'Compiles to small JavaScript, with SvelteKit for routing and every rendering mode. Pick it when bundle size and simplicity weigh most and a smaller ecosystem is acceptable.' },
        { value: 'htmx', label: 'server-rendered HTML with htmx', description: 'The back end renders HTML from templates; htmx swaps parts of the page, and Alpine.js holds small client state. Pick it for forms-and-tables applications when the team is back-end heavy and rich client-side interaction is rare.' },
      ],
    },
    {
      key: 'RENDERING', title: 'Rendering', label: 'Where are pages rendered?',
      hint: 'Rendering decides what the first response holds: an empty shell, the content, or a file built in advance. It sets first-load speed, search visibility and what the server must do.',
      default: 'ssr',
      options: [
        { value: 'spa', label: 'in the browser (single-page app)', description: 'The server sends a shell and the browser renders everything. Pick it for applications behind sign-in, used for long sessions, where search engines do not matter and later navigation must be instant.' },
        { value: 'ssr', label: 'on the server for each request (SSR)', description: 'Each request gets HTML with its content, then the page becomes interactive. Pick it for public pages with personalised or fast-changing content where search and first load matter.' },
        { value: 'static', label: 'at build time (static generation)', description: 'Pages are built in advance and served from a CDN, rebuilt when content changes. Pick it for content that is the same for everyone and changes at most a few times an hour (marketing, documentation, catalogues).' },
      ],
    },
    {
      key: 'DESIGN', title: 'Design system', label: 'What are the screens built from?',
      hint: 'A design system keeps screens consistent and accessible; the question is whether you build it, adopt one, or compose one from utilities.',
      default: 'library',
      options: [
        { value: 'own', label: 'our own design system', description: 'Our components and design tokens, built on accessible headless primitives (Radix, React Aria, Angular CDK), documented in Storybook. Pick it when the brand must be distinct and several applications share it, and a team can own it.' },
        { value: 'library', label: 'an established component library', description: 'An off-the-shelf library themed to the brand: MUI, Angular Material, Vuetify, PrimeNG, Fluent UI, Skeleton. Pick it for business applications where speed matters more than a distinct look.' },
        { value: 'utility', label: 'utility CSS with copied components', description: 'Tailwind CSS with the design tokens in its theme, and components copied into the codebase (shadcn/ui and similar). Pick it when you want full control of the markup without maintaining a separate library.' },
      ],
    },
    {
      key: 'BROWSERS', title: 'Browser support', label: 'Which browsers must work?',
      hint: 'The browser list decides which language features and CSS ship untranspiled, which polyfills load, and which browsers the tests run in.',
      default: 'defaults',
      options: [
        { value: 'modern', label: 'the last two versions of Chrome, Edge, Firefox and Safari', description: 'Only current evergreen browsers. Pick it for internal tools and applications whose users have managed, up-to-date devices.' },
        { value: 'defaults', label: 'browserslist defaults (over 0.5% use, last 2 versions, Firefox ESR)', description: 'The broad default most public sites use. Pick it for public sites and applications with a general audience.' },
        { value: 'extended', label: 'an extended list, including older phones (iOS 15 and later)', description: 'Over 0.2% use, last 3 versions, Firefox ESR, iOS Safari 15 and later. Pick it when analytics show many users on older phones (emerging markets, public services that must reach everyone).' },
      ],
    },
  ],
  details: [
    { key: 'LCP_MS', label: 'Largest Contentful Paint at the 75th percentile (ms)?', default: '2500', number: true },
    { key: 'INP_MS', label: 'Interaction to Next Paint at the 75th percentile (ms)?', default: '200', number: true },
    { key: 'CLS', label: 'Cumulative Layout Shift at the 75th percentile?', default: '0.1', number: true },
    { key: 'JS_KB', label: 'At most how much JavaScript may a route load before it is interactive (KB, compressed)?', default: '200', number: true },
    { key: 'EOL_DAYS', label: 'How many days before end of support must a framework major be replaced?', default: '180', number: true },
  ],
  need: {
    label: 'A fast, accessible front end',
    text: 'People use this front end on their own devices, browsers and networks, some with disabilities and assistive technology. It has to load and respond quickly on an ordinary phone, work in the browsers its users have, be usable by everyone, look and behave consistently, and be built on a framework the team knows and that keeps receiving fixes. The choices and the numbers it is held to must be written down and checked, not rediscovered after users complain.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-one-framework', label: 'Built on the chosen framework', ears_type: 'ubiquitous',
      action: 'build the front end with {{FRAMEWORK}}, adding another UI framework only after a new decision record supersedes this one',
      rationale: 'Two UI frameworks in one front end double the JavaScript users download and the skills the team needs (Thoughtworks Technology Radar).',
      scenario: { label: 'Second framework refused', given: 'the front end\'s dependencies', when: 'a change adds another UI framework', then: 'the dependency check fails until a decision record allows it' },
    },
    {
      id: 'req-vitals', label: 'Core Web Vitals met', ears_type: 'ubiquitous',
      action: 'meet, at the 75th percentile of real page loads on mobile and desktop, a Largest Contentful Paint within {{LCP_MS}} ms, an Interaction to Next Paint within {{INP_MS}} ms and a Cumulative Layout Shift of at most {{CLS}}',
      rationale: 'These are the thresholds for a "good" experience, measured at the 75th percentile of field data (web.dev, Web Vitals: LCP 2.5 s, INP 200 ms, CLS 0.1); they also feed search ranking.',
      scenario: { label: 'Field vitals within budget', given: 'a month of real-user measurements per page group', when: 'the 75th percentiles are computed', then: 'LCP is within {{LCP_MS}} ms, INP within {{INP_MS}} ms and CLS at most {{CLS}} for every page group' },
    },
    {
      id: 'req-bundle', label: 'JavaScript within budget', ears_type: 'ubiquitous',
      action: 'keep the JavaScript a route loads before it is interactive within {{JS_KB}} KB compressed, loading the rest on demand',
      rationale: 'JavaScript is the costliest byte on a phone: it is downloaded, parsed and run on the main thread, which is what INP measures (web.dev, performance budgets).',
      scenario: { label: 'Bundle over budget refused', given: 'a pull request that adds a large library to a route', when: 'the size check runs', then: 'it fails when the route\'s JavaScript passes {{JS_KB}} KB compressed' },
    },
    {
      id: 'req-a11y', label: 'Accessible to WCAG 2.2 AA', ears_type: 'ubiquitous',
      action: 'conform to WCAG 2.2 level AA on every page, with 0 serious or critical automated accessibility violations, every function operable by keyboard alone, and a manual audit with a screen reader before each major release',
      rationale: 'WCAG 2.2 AA is the level EN 301 549, the European Accessibility Act and most public-sector rules require; automated checks find only part of the failures, hence the manual audit (W3C WCAG 2.2).',
      scenario: { label: 'Page passes accessibility checks', given: 'each page of the main journeys', when: 'the automated checks run and the page is used with keyboard only', then: '0 serious or critical violations are reported and every function can be reached and used' },
    },
    {
      id: 'req-supported', label: 'Supported framework versions', ears_type: 'ubiquitous',
      action: 'run only framework and build-tool majors under support, moving off each at least {{EOL_DAYS}} days before its end of support, with dependency updates proposed automatically every week',
      rationale: 'Front-end frameworks support a major for a limited time (Angular 18 months, Node.js-based tooling with its runtime); after that, security fixes stop (endoflife.date; OWASP Top 10 A06).',
      scenario: { label: 'End of support ahead', given: 'a framework major whose end of support is less than {{EOL_DAYS}} days away', when: 'the version check runs', then: 'it fails naming the version and its end-of-support date' },
    },
    {
      id: 'req-spa-cache', label: 'App shell cached right', when: { RENDERING: ['spa'] }, ears_type: 'event-driven',
      trigger: 'a new version of the single-page app is deployed',
      action: 'serve its content-hashed assets with a one-year immutable cache and its HTML with no-cache, so that every user gets the new version on their next navigation and 0 users load a mix of versions',
      rationale: 'A single-page app is a shell plus assets; wrong caching either serves stale code for days or downloads everything on every visit (web.dev, HTTP caching).',
      scenario: { label: 'New version reaches users', given: 'a user with the previous version cached', when: 'a new version is deployed and the user navigates', then: 'the new HTML loads, its hashed assets are fetched once, and the unchanged ones come from the cache' },
    },
    {
      id: 'req-ssr', label: 'Content in the first response', when: { RENDERING: ['ssr'] }, ears_type: 'event-driven',
      trigger: 'a page is requested',
      action: 'answer with HTML that already holds the page\'s main content, with a Time to First Byte within 800 ms at the 75th percentile',
      rationale: 'Server rendering pays off only if the server answers quickly; 800 ms is web.dev\'s "good" Time to First Byte, which leaves room for LCP within budget.',
      scenario: { label: 'Content without JavaScript', given: 'a public page', when: 'it is requested with JavaScript disabled', then: 'its main content is in the HTML, and the 75th-percentile TTFB is within 800 ms' },
    },
    {
      id: 'req-static', label: 'Pages built in advance', when: { RENDERING: ['static'] }, ears_type: 'event-driven',
      trigger: 'content is published or changed',
      action: 'rebuild the affected pages and serve them from the CDN within 15 minutes, with 100% of pages served as pre-built files',
      rationale: 'Static pages are the fastest and cheapest to serve; the publishing delay is the price, and it must be bounded (web.dev, rendering on the web).',
      scenario: { label: 'Change live within 15 minutes', given: 'a published page', when: 'its content is changed', then: 'the CDN serves the rebuilt page within 15 minutes' },
    },
    {
      id: 'req-design-own', label: 'Screens use our design system', when: { DESIGN: ['own'] }, ears_type: 'ubiquitous',
      action: 'build every screen from the design system\'s components and tokens, document each component with its states in Storybook, and use 0 hard-coded colours, font sizes or spacing outside the tokens',
      rationale: 'A design system pays off only when used everywhere; tokens make a brand or contrast change one edit instead of a search (W3C Design Tokens Community Group).',
      scenario: { label: 'Hard-coded colour refused', given: 'a stylesheet change', when: 'it sets a colour as a hex value instead of a token', then: 'the style lint fails' },
    },
    {
      id: 'req-design-library', label: 'Library used through its theme', when: { DESIGN: ['library'] }, ears_type: 'ubiquitous',
      action: 'style the component library only through its theme and public props, with 0 overrides of its internal class names, so that it can be upgraded to each new major within 6 months',
      rationale: 'Overrides of a library\'s internals break on its next major and pin the front end to an old version (the library\'s own theming guides).',
      scenario: { label: 'Internal override refused', given: 'a stylesheet change', when: 'it targets one of the library\'s internal class names', then: 'the style lint fails' },
    },
    {
      id: 'req-design-utility', label: 'Utilities use the tokens', when: { DESIGN: ['utility'] }, ears_type: 'ubiquitous',
      action: 'take colours, spacing and type sizes only from the tokens in the Tailwind theme, with 0 arbitrary values in class names',
      rationale: 'Arbitrary values bypass the theme and turn the design system back into one-off styles (Tailwind CSS documentation, theme).',
      scenario: { label: 'Arbitrary value refused', given: 'a component change', when: 'it uses a class with an arbitrary value such as a hex colour in brackets', then: 'the lint fails' },
    },
    {
      id: 'req-browsers', label: 'Supported browsers work', ears_type: 'ubiquitous',
      action: 'work in every browser of {{BROWSERS}}, with the main journeys tested in Chromium, Firefox and WebKit on every pull request and 0 unsupported language or web features shipped without a polyfill',
      rationale: 'An explicit browser list lets the build ship only the transpilation and polyfills needed, and the lint catch a feature the list does not have (Browserslist).',
      scenario: { label: 'Unsupported feature caught', given: 'the browser list', when: 'a change uses a web feature a listed browser lacks', then: 'the compatibility lint fails unless a polyfill is configured' },
    },
    {
      id: 'req-unsupported', label: 'Old browsers told', when: { BROWSERS: ['modern'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the front end is opened in a browser outside the supported list',
      action: 'show a notice naming the supported browsers instead of a broken page',
      rationale: 'A short browser list is acceptable only if users outside it learn why the page fails (Browserslist).',
      scenario: { label: 'Notice in old browser', given: 'a browser two years older than the list', when: 'the front end is opened', then: 'the notice names the supported browsers' },
    },
    {
      id: 'req-old-devices', label: 'Tested on older phones', when: { BROWSERS: ['extended'] }, ears_type: 'event-driven',
      trigger: 'a release candidate is built',
      action: 'run the main journeys on real devices with the oldest supported iOS Safari and a low-end Android phone, and meet the Core Web Vitals budget on the Android phone',
      rationale: 'Emulated browsers miss the CPU and memory limits of old phones, where an extended audience feels the budget most (web.dev, Web Vitals).',
      scenario: { label: 'Journeys pass on old phones', given: 'a release candidate', when: 'the main journeys run on the oldest supported iPhone and a low-end Android phone', then: 'all pass, and LCP on the Android phone is within {{LCP_MS}} ms' },
    },
  ],
  adrs: [
    {
      id: 'adr-react', label: 'Built with React', when: { FRAMEWORK: ['react'] },
      decision: 'The front end is built with React in TypeScript (strict). Rendering: {{RENDERING}}: Next.js (App Router, server components) for server rendering and static generation, Vite with React Router for a single-page app. Data fetching with TanStack Query; forms with React Hook Form. Design system: {{DESIGN}}. Browsers: {{BROWSERS}}. Budget: LCP {{LCP_MS}} ms, INP {{INP_MS}} ms, CLS {{CLS}} at the 75th percentile, {{JS_KB}} KB of JavaScript per route; WCAG 2.2 AA. Choosing Next.js or React Router (framework mode): Next.js for the widest ecosystem and hosting on Vercel or Node; React Router when you want web-standard loaders and fewer conventions. Versions tracked through endoflife.date (react, nextjs).',
      consequences: '• The largest ecosystem of components and libraries, and the largest hiring pool.\n• React itself is only the view: routing, data, forms and state are choices to make and keep current.\n• Server components cut the JavaScript sent, but add a server and a new mental model.\n• Next.js majors arrive roughly yearly and change conventions; upgrades are planned work.',
      alternatives: '1. Angular: everything included and one way of doing it, heavier.\n2. Vue with Nuxt: similar capabilities, gentler learning curve, smaller ecosystem.\n3. Svelte with SvelteKit: smaller bundles, smaller ecosystem.',
    },
    {
      id: 'adr-angular', label: 'Built with Angular', when: { FRAMEWORK: ['angular'] },
      decision: 'The front end is built with Angular in TypeScript (strict), with standalone components, signals and the Angular CLI (esbuild). Rendering: {{RENDERING}}: Angular SSR with hydration for server rendering, prerendering for static pages, the default build for a single-page app. Design system: {{DESIGN}} (Angular Material and the CDK when adopting a library). Browsers: {{BROWSERS}}. Budget: LCP {{LCP_MS}} ms, INP {{INP_MS}} ms, CLS {{CLS}} at the 75th percentile, {{JS_KB}} KB of JavaScript per route, also set in angular.json budgets; WCAG 2.2 AA. Each major is supported for 18 months (6 active, 12 LTS), so the front end moves one major at a time with ng update, at least once a year.',
      consequences: '• Routing, forms, HTTP, testing and i18n come with the framework: one way of doing things across teams.\n• Larger initial bundles than Svelte or Vue unless routes are lazy-loaded and deferrable views used.\n• A predictable release and support schedule makes the version policy easy to plan.\n• A steeper learning curve (dependency injection, RxJS) for people new to it.',
      alternatives: '1. React with Next.js: larger ecosystem, more choices to make.\n2. Vue with Nuxt: lighter, less prescriptive.\n3. Server-rendered HTML with htmx: far less JavaScript for forms-and-tables applications.',
    },
    {
      id: 'adr-vue', label: 'Built with Vue', when: { FRAMEWORK: ['vue'] },
      decision: 'The front end is built with Vue 3 in TypeScript, using the Composition API and single-file components. Rendering: {{RENDERING}}: Nuxt for server rendering and static generation, Vite with Vue Router for a single-page app. State in Pinia. Design system: {{DESIGN}}. Browsers: {{BROWSERS}}. Budget: LCP {{LCP_MS}} ms, INP {{INP_MS}} ms, CLS {{CLS}} at the 75th percentile, {{JS_KB}} KB of JavaScript per route; WCAG 2.2 AA. Versions tracked through endoflife.date (vue, nuxt).',
      consequences: '• Gentle learning curve and good performance out of the box.\n• Can be adopted gradually inside existing server-rendered pages.\n• A smaller ecosystem and hiring pool than React.\n• Nuxt majors bring migration work; plan them like framework upgrades.',
      alternatives: '1. React with Next.js: the largest ecosystem.\n2. Svelte with SvelteKit: smaller bundles.\n3. Angular: more included, more prescriptive.',
    },
    {
      id: 'adr-svelte', label: 'Built with Svelte', when: { FRAMEWORK: ['svelte'] },
      decision: 'The front end is built with Svelte 5 (runes) in TypeScript and SvelteKit, whose adapters cover every rendering mode. Rendering: {{RENDERING}}: adapter-node or a platform adapter for server rendering, adapter-static for static pages and single-page apps. Design system: {{DESIGN}}. Browsers: {{BROWSERS}}. Budget: LCP {{LCP_MS}} ms, INP {{INP_MS}} ms, CLS {{CLS}} at the 75th percentile, {{JS_KB}} KB of JavaScript per route; WCAG 2.2 AA. Versions tracked through endoflife.date (svelte).',
      consequences: '• Compiled components ship little JavaScript, which makes the budget easy to keep.\n• Simple syntax, quick to learn.\n• A smaller ecosystem: fewer ready-made components and integrations, more built in-house.\n• A smaller hiring pool than React, Angular or Vue.',
      alternatives: '1. React with Next.js: the largest ecosystem, more JavaScript.\n2. Vue with Nuxt: similar simplicity, larger ecosystem.\n3. Server-rendered HTML with htmx: even less JavaScript, less interactivity.',
    },
    {
      id: 'adr-htmx', label: 'Server-rendered HTML with htmx', when: { FRAMEWORK: ['htmx'] },
      decision: 'The front end is HTML rendered by the back end from templates (Thymeleaf, Razor, Jinja, templ or the back end\'s own), with htmx swapping parts of the page and Alpine.js for small client-side state; no client-side framework or build step beyond CSS. Rendering: {{RENDERING}}, with every page server rendered and partial updates over HTTP. Design system: {{DESIGN}}, delivered as template partials. Browsers: {{BROWSERS}}. Budget: LCP {{LCP_MS}} ms, INP {{INP_MS}} ms, CLS {{CLS}} at the 75th percentile, {{JS_KB}} KB of JavaScript per page; WCAG 2.2 AA. Choose it while interactions are forms, tables, filters and dialogs; supersede it when screens need rich client state (offline, drag-and-drop editors, real-time collaboration).',
      consequences: '• Very little JavaScript, no client-side state to keep in sync, one codebase and one team for front and back end.\n• Fast first loads; every interaction is a request, so latency to the server sets how responsive it feels.\n• Rich client-side interaction is awkward and grows into hand-written JavaScript.\n• Fewer ready-made components; the design system is built as template partials.',
      alternatives: '1. A single-page app framework (React, Angular, Vue, Svelte): rich interaction, much more JavaScript and a second codebase.\n2. Hotwire (Turbo and Stimulus) or Phoenix LiveView: the same idea tied to Rails or Elixir.\n3. Plain server-rendered pages without htmx: simplest, full reloads.',
    },
  ],
  fitness: [
    {
      id: 'ff-lighthouse', label: 'Lab budget holds', category: 'operational', implements: FRAMEWORKS,
      threshold: 'On every pull request, for each main page: LCP within {{LCP_MS}} ms, CLS at most {{CLS}}, Total Blocking Time within 200 ms (the lab stand-in for INP), accessibility score at least 0.95',
      description: 'Lighthouse CI runs three times per main page on a mobile profile against the preview build and asserts the budget; the median run counts. INP needs real interactions, so it is checked in the field (see Field vitals).',
      tool: 'Lighthouse CI',
      language: 'js',
      snippet: `// lighthouserc.cjs
module.exports = {
  ci: {
    collect: { url: ['http://localhost:4173/', 'http://localhost:4173/search'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: {{LCP_MS}}, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: {{CLS}}, aggregationMethod: 'median' }],
        'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}`,
    },
    {
      id: 'ff-field-vitals', label: 'Field vitals within budget', category: 'operational', implements: FRAMEWORKS,
      threshold: '75th percentile over 28 days per page group: LCP within {{LCP_MS}} ms, INP within {{INP_MS}} ms, CLS at most {{CLS}}; an alert when one is exceeded',
      description: 'The web-vitals library reports LCP, INP and CLS from real users to the analytics endpoint; a dashboard computes the 75th percentile per page group and alerts when one passes the budget. The Chrome UX Report gives the same figures for public pages.',
      tool: 'web-vitals (Google Chrome) real-user monitoring',
      language: 'ts',
      snippet: `import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'

const BUDGET = { LCP: {{LCP_MS}}, INP: {{INP_MS}}, CLS: {{CLS}} }

function report(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name, value: metric.value, rating: metric.rating,
    page: location.pathname.replace(/\\/\\d+/g, '/:id'), overBudget: metric.value > BUDGET[metric.name as keyof typeof BUDGET],
  })
  navigator.sendBeacon('/rum', body)
}
onLCP(report); onINP(report); onCLS(report)`,
    },
    {
      id: 'ff-size', label: 'JavaScript size budget', category: 'structural', implements: FRAMEWORKS,
      threshold: 'Each route\'s initial JavaScript within {{JS_KB}} KB compressed; the pull request fails above it',
      description: 'size-limit measures the compressed JavaScript of each route\'s entry chunks after the production build and fails the pull request above the limit, with a comment showing the change.',
      tool: 'size-limit',
      language: 'json',
      snippet: `[
  { "name": "home", "path": "dist/assets/index-*.js", "limit": "{{JS_KB}} KB", "gzip": true },
  { "name": "search", "path": "dist/assets/search-*.js", "limit": "{{JS_KB}} KB", "gzip": true }
]`,
    },
    {
      id: 'ff-axe', label: 'No accessibility violations', category: 'structural', implements: FRAMEWORKS,
      threshold: '0 serious or critical axe violations against WCAG 2.0, 2.1 and 2.2 A and AA rules on every page of the main journeys',
      description: 'A Playwright test opens each page of the main journeys, including open dialogs and error states, and runs axe-core with the WCAG A and AA tags; any serious or critical violation fails it.',
      tool: 'axe-core with Playwright (@axe-core/playwright)',
      language: 'ts',
      snippet: `import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const path of ['/', '/search', '/checkout']) {
  test(\`\${path} meets WCAG 2.2 AA\`, async ({ page }) => {
    await page.goto(path)
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })
}`,
    },
    {
      id: 'ff-compat', label: 'Features match browser list', category: 'structural', implements: FRAMEWORKS,
      threshold: '0 uses of web features missing from a browser on the list without a configured polyfill',
      description: 'The browser list lives in package.json and drives the build\'s transpilation; eslint-plugin-compat fails on a web API one of the listed browsers lacks. Playwright runs the journeys in Chromium, Firefox and WebKit.',
      tool: 'browserslist with eslint-plugin-compat',
      language: 'js',
      snippet: `// package.json: "browserslist" holds the query of the policy, e.g.
//   modern:   ["last 2 Chrome versions", "last 2 Edge versions", "last 2 Firefox versions", "last 2 Safari major versions"]
//   defaults: ["defaults"]
//   extended: ["> 0.2%", "last 3 versions", "Firefox ESR", "iOS >= 15", "not dead"]
// eslint.config.mjs
import compat from 'eslint-plugin-compat'
export default [
  compat.configs['flat/recommended'],
  { settings: { polyfills: ['fetch', 'Promise'] } },   // what the build polyfills
]`,
    },
    {
      id: 'ff-eol', label: 'Framework still supported', category: 'operational', implements: FRAMEWORKS,
      threshold: '0 framework or build-tool majors within {{EOL_DAYS}} days of their end of support',
      description: 'A scheduled job and every build look up the framework majors in use on endoflife.date (angular, nextjs, nuxt, vue, svelte, nodejs for the build) and fail when end of support is less than {{EOL_DAYS}} days away.',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# versions.txt: "<endoflife.date product> <cycle>", e.g. "angular 20", "nodejs 22"
set -euo pipefail
LIMIT=$(( $(date +%s) + {{EOL_DAYS}} * 86400 ))
fail=0
while read -r product cycle; do
  eol=$(curl -fsS "https://endoflife.date/api/\${product}/\${cycle}.json" | jq -r '.eol')
  [ "$eol" = "false" ] && continue
  if [ "$eol" = "true" ] || [ "$(date -d "$eol" +%s)" -lt "$LIMIT" ]; then
    echo "::error::$product $cycle reaches end of support on $eol"; fail=1
  fi
done < versions.txt
exit $fail`,
    },
    {
      id: 'ff-renovate', label: 'Dependencies kept current', category: 'process', implements: FRAMEWORKS,
      threshold: 'Update pull requests opened weekly; framework packages updated together; 0 update pull requests open over 30 days',
      description: 'Renovate opens weekly update pull requests, grouping the packages of one framework or monorepo so they move together; patches merge automatically when the tests, the size limit and Lighthouse CI pass.',
      tool: 'Renovate',
      language: 'json',
      snippet: `{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", "group:monorepos", ":dependencyDashboard"],
  "schedule": ["before 6am on monday"],
  "minimumReleaseAge": "3 days",
  "packageRules": [
    { "matchUpdateTypes": ["patch"], "automerge": true },
    { "matchUpdateTypes": ["major"], "labels": ["major-update"] }
  ]
}`,
    },
    {
      id: 'ff-cache-headers', label: 'Cache headers right', when: { RENDERING: ['spa'] }, category: 'operational', implements: FRAMEWORKS,
      threshold: '100% of hashed assets served with max-age=31536000, immutable; index.html with no-cache',
      description: 'After each deploy a check fetches the HTML and the assets it references and verifies their Cache-Control headers.',
      tool: 'curl (post-deploy check)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
html=$(curl -fsSI "$BASE_URL/" | tr -d '\\r' | grep -i '^cache-control')
grep -qi 'no-cache' <<<"$html" || { echo "index.html: $html"; exit 1; }
for asset in $(curl -fsS "$BASE_URL/" | grep -oE '/assets/[^"]+\\.(js|css)'); do
  cc=$(curl -fsSI "$BASE_URL$asset" | tr -d '\\r' | grep -i '^cache-control')
  grep -qi 'max-age=31536000' <<<"$cc" && grep -qi 'immutable' <<<"$cc" || { echo "$asset: $cc"; exit 1; }
done`,
    },
    {
      id: 'ff-ttfb', label: 'Server answers quickly', when: { RENDERING: ['ssr'] }, category: 'operational', implements: FRAMEWORKS,
      threshold: 'Time to First Byte within 800 ms at the 75th percentile under the expected load',
      description: 'A k6 test requests the main server-rendered pages at the expected load and checks the time to first byte (http_req_waiting) and that the HTML holds the main content.',
      tool: 'Grafana k6',
      language: 'js',
      snippet: `import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 50, duration: '5m',
  thresholds: { http_req_waiting: ['p(75)<800'], http_req_failed: ['rate<0.01'] },
}

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/products\`)
  check(res, { 'content rendered on the server': (r) => r.body.includes('data-testid="product-list"') })
}`,
    },
    {
      id: 'ff-tokens', label: 'Only design tokens', when: { DESIGN: ['own'] }, category: 'structural', implements: FRAMEWORKS,
      threshold: '0 hard-coded colours, font sizes or spacing in stylesheets outside the token files',
      description: 'Stylelint requires design-token variables for colour, font size and spacing properties; the token files themselves are exempt.',
      tool: 'Stylelint (stylelint-declaration-strict-value)',
      language: 'json',
      snippet: `{
  "plugins": ["stylelint-declaration-strict-value"],
  "rules": {
    "color-no-hex": true,
    "scale-unlimited/declaration-strict-value": [
      ["/color$/", "font-size", "/^(margin|padding|gap)/"],
      { "ignoreValues": ["inherit", "transparent", "currentColor", "0", "auto"] }
    ]
  },
  "ignoreFiles": ["src/tokens/**"]
}`,
    },
    {
      id: 'ff-no-overrides', label: 'No library internals styled', when: { DESIGN: ['library'] }, category: 'structural', implements: FRAMEWORKS,
      threshold: '0 selectors targeting the component library\'s internal class names',
      description: 'Stylelint refuses selectors with the library\'s internal class prefixes, so styling goes through the theme. Adjust the patterns to the library used (MUI: .Mui, Angular Material: .mat-mdc / .mdc-, PrimeNG: .p-).',
      tool: 'Stylelint (selector-disallowed-list)',
      language: 'json',
      snippet: `{
  "rules": {
    "selector-disallowed-list": [
      ["/\\\\.Mui[A-Z]/", "/\\\\.mat-mdc-/", "/\\\\.mdc-/", "/::ng-deep/"],
      { "message": "Style the component library through its theme (ADR Frontend stack)" }
    ]
  }
}`,
    },
    {
      id: 'ff-tailwind', label: 'No arbitrary utility values', when: { DESIGN: ['utility'] }, category: 'structural', implements: FRAMEWORKS,
      threshold: '0 arbitrary values (such as bg-[#1da1f2]) in class names',
      description: 'The Tailwind ESLint plugin refuses arbitrary values in class names, so colours, spacing and type sizes come from the theme\'s tokens.',
      tool: 'ESLint (eslint-plugin-tailwindcss)',
      language: 'js',
      snippet: `// eslint.config.mjs
import tailwind from 'eslint-plugin-tailwindcss'
export default [
  ...tailwind.configs['flat/recommended'],
  { rules: { 'tailwindcss/no-arbitrary-value': 'error', 'tailwindcss/no-custom-classname': 'warn' } },
]`,
    },
  ],
}

export default pack
