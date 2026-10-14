---
id: "ee70220a-3894-4936-a06d-30ce6d95dc1a"
type: "scenario"
label: "Delete ignored while presenting"
given: "a presentation started with F5 on the System Context view"
tests: "apps/e2e/tests/studio/runs-13-24.spec.ts › Delete while a presentation plays does nothing"
then: "no prompt opens and the view still lists the element"
when: "the user clicks the Payments element, presses Delete, then Escape"
---
