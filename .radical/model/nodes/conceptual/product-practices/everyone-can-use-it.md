---
id: "278066be-80d4-4e94-b25b-c9772c7c6bf6"
type: "need"
label: "Everyone can use it"
kind: "brief"
source: "Hub concern pack: Accessibility"
---

People with disabilities use this front end with a keyboard, a screen reader, magnification or voice control, and the law may require that they can. Every function of the main journeys must work for them, to a WCAG level that is decided and checked on every change, with what automated checks cannot see tested by people, what is not yet accessible stated openly, and failures fixed on a schedule rather than when someone complains. The checks assume Playwright tests under tests/a11y with tests/a11y/pages.ts listing the pages of the main journeys (PAGES: path) and the states worth checking (STATES: a name, a path and, where needed, the steps that open a dialog, show a form's errors or empty a list); playwright.config sets the baseURL and, for pages behind sign-in, a storageState. Each test fails on its own in a plain run and, run by radical sense playwright, writes what it measured as a radical-metrics/1 file into RADICAL_METRICS_DIR.
