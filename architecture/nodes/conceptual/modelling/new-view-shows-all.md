---
id: "220648e9-eb44-445b-b85f-3f988ac247b8"
type: "scenario"
label: "New view shows all"
given: "a model"
metrics: |
  test(packages/ui/tests/views.test.ts › addView / addNodeToView / removeNodeFromView › addView creates a new empty view and returns its id) passed
  test(packages/ui/tests/views.test.ts › addView / addNodeToView / removeNodeFromView › a node created while a "show all" view is active keeps every node visible) passed
  test(apps/e2e/tests/studio/views.spec.ts › blank views are named View 1, View 2…) passed
then: "it gets the name, an empty element list that shows every element, and a node created while it is active keeps every node visible; blank views made one after another are named View 1, View 2"
when: "a new view is added"
---
