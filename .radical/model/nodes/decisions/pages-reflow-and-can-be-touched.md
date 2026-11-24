---
id: "c3822333-db92-4a88-b679-1f731008f8d8"
type: "adr"
label: "Pages reflow and can be touched"
alternatives: |
  1. Manual checks on a device bench before release: catches what emulation misses, but late and by hand.
  2. axe-core's target-size rule alone: checks 2.5.8 but not Reflow, and gives no count to judge.
  3. A cloud device farm (BrowserStack, Sauce Labs) for every pull request: real devices, at a price per minute and with slower runs.
concern: "mobile-performance"
consequences: |
  • A layout that scrolls sideways or a target too small to hit fails the pull request, with the page, viewport and element in the test report.
  • Emulated phones are not real ones: CPU, memory and the browser chrome of a real device are not tested here.
  • With screenshots, every intended visual change needs its new screenshots approved in the pull request.
  • Larger targets take room: dense tables and toolbars need a design that spaces them.
context: "This element is a web front end that people open on their own phones and computers, over networks they do not choose. The forces: most visits come from mid-range phones on mobile networks, where every image and script costs seconds that a developer's laptop never shows; what users feel is how soon the main content appears (LCP), how soon a tap answers (INP) and whether the page jumps while it loads (CLS), and Google measures exactly these at the 75th percentile of real visits; lab runs on every change are repeatable but simulate one phone on one network, field data is the truth but arrives days later and only once the page is live; lab timings depend on the CPU of the machine that runs them; people zoom, use small screens and hit targets with a thumb, so a layout that scrolls sideways at 320 CSS px or a 16 px icon button fails some of them (WCAG 2.2: Reflow, Target Size); and a layout that breaks on a phone is seldom seen by a team that works on desktops."
date: "2026-11-24"
decision: "Every page works in a window 320 CSS px wide (a 1280 px window at 400% zoom) and on phone viewports without scrolling sideways, as WCAG 2.2 SC 1.4.10 requires; parts that need two dimensions (maps, diagrams, wide tables) scroll inside their own container. Every pointer target is at least 24 × 24 CSS px (WCAG 2.2 Target Size Minimum, level AA), with the exceptions WCAG 2.2 SC 2.5.8 allows. A Playwright test measures both on every pull request in four viewports (320 CSS px; iPhone 15 and Pixel 7 as Playwright emulates them; a 1280 px desktop) and writes what it found as radical-metrics/1, which the model's conditions judge. Screenshots on phones: no screenshot comparison; when compared, they are taken in the Playwright Docker image of the version in use, locally and in CI alike, as fonts and rendering differ between systems. The rest of WCAG 2.2 AA (automated rules, the keyboard, the manual audit) is decided in the Accessibility pack; the framework and browser support in the Frontend stack pack."
status: "accepted"
---
