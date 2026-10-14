---
id: "03d26ac8-233e-4f88-8d80-f8fb29d4bc09"
type: "scenario"
label: "View membership toggled"
given: "a named view"
tests: |
  packages/ui/tests/views.test.ts › addView / addNodeToView / removeNodeFromView › addNodeToView appends a node id; removeNodeFromView removes it
  packages/ui/tests/views.test.ts › addView / addNodeToView / removeNodeFromView › removeNodeFromView cascades to all descendants
then: "the added id is appended to the view, and the removed element leaves the view together with its descendants"
when: "an element is added to the view and another is removed from it"
---
