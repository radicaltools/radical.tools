---
id: "3f12d2cd-0d43-44ee-9c62-18e8a73a0513"
type: "scenario"
label: "Present with a menu open"
given: "the Discuss menu, the relation type asked for after a drop, or the Explore menu open over the canvas"
metrics: |
  test(apps/e2e/tests/studio/discussions.spec.ts › F5 with the Discuss menu open presents without it, and the keys move the slides) passed
  test(packages/ui/tests/presentation.test.ts › Present with a menu open over the canvas › closes the relation type asked for and the Explore menu, adding nothing) passed
then: "the presentation starts without the menu, nothing is added, and → and Space move the slides"
when: "the user presses F5, then the slide keys"
---
