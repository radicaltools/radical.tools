---
id: "b0e872ef-b21d-4e2e-ae7a-08f6ec9ab2fe"
type: "scenario"
label: "A rewrite the filter leaves out"
given: "a wiki page read on a view whose filter shows its element"
metrics: "test(apps/e2e/tests/studio/wiki.spec.ts › a rewrite the view's filter leaves out says so, and Undo brings its page back) passed"
then: "the page says the view's filter does not show the element any more; Undo brings the wiki back to its page"
when: "the user rewrites the element so the filter leaves it out, then presses Undo"
---
