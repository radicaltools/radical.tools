---
id: "888def3b-085c-49c1-8356-9d59ac3dd604"
type: "scenario"
label: "Export leaves out the controls"
given: "a view whose elements have discussion threads, and an exploration grown with + from an element"
tests: |
  apps/e2e/tests/studio/web-discussions.spec.ts › an export of the view leaves out the discussion icons
  apps/e2e/tests/studio/export.spec.ts › an exploration is exported without its bar and its + and −
then: "the picture shows the elements and their relations without the discussion icons, the exploration's bar, or the + and − of its elements"
when: "the user exports the view, and the exploration, as an image"
---
