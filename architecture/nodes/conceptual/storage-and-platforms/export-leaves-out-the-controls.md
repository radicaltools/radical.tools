---
id: "888def3b-085c-49c1-8356-9d59ac3dd604"
type: "scenario"
label: "Export leaves out the controls"
given: "a view whose elements have discussion threads, and an exploration grown with + from an element; and a view with a pinned element, a row, a folded frame and an element selected"
metrics: |
  test(apps/e2e/tests/studio/web-discussions.spec.ts › an export of the view leaves out the discussion icons) passed
  test(apps/e2e/tests/studio/export.spec.ts › an exploration is exported without its bar and its + and −) passed
  test(apps/e2e/tests/studio/export.spec.ts › an export leaves out the pin, the alignment guides, the −/+ and the selection) passed
  test(packages/ui/tests/presentation.test.ts › An export with an element selected › draws no focus while it is drawn, and the focus comes back after) passed
then: "the picture shows the elements and their relations without the discussion icons, the exploration's bar, or the + and − of its elements; nor the pin, the alignment guides, the − and +, the selection or Focus's dimming, and the selection and Focus are back after"
when: "the user exports the view, and the exploration, as an image; and exports that view"
---
