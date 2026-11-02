---
id: "8bbc2b60-5cca-4055-b1ed-52e14c6475d9"
type: "scenario"
label: "Slides show what they hold"
given: "a presentation with a table slide, a slide focused on Orders DB, a slide of a view never laid out and a slide added on a wiki page"
metrics: |
  test(apps/e2e/tests/studio/presentation.spec.ts › a slide made with focus zooms onto its elements after a table slide, from a deep link and after a reload) passed
  test(apps/e2e/tests/studio/presentation.spec.ts › a slide card's Link view and Link milestone pickers show all their items above the dock) passed
  test(apps/e2e/tests/studio/presentation.spec.ts › a slide added on a wiki page shows that page, on its card and played after a reload) passed
  test(packages/ui/tests/firstCanvasPositions.test.ts › a slide of a view with no positions of its own) passed
  test(packages/ui/tests/treemapFocus.test.ts › a slide added on a wiki page) passed
then: "the focus slide zooms onto Orders DB also after the table slide, from the link and after the reload; the never-laid-out view opens with its elements inside their containers; the wiki slide shows its page and page mode without changing the view's own page; the Link view and Link milestone pickers show all their items above the dock"
when: "the slides are played, shown from their cards, opened from a deep link and after a reload"
---
