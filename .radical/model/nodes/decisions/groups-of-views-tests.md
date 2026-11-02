---
id: "473526cc-a938-4acb-8d00-5842463d30a0"
type: "fitness-fn"
label: "Groups of views tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(packages/common/tests/viewpoints.test.ts › viewpoint subjects) passed
  test(packages/common/tests/viewpoints.test.ts › built-in viewpoints of one element) passed
  test(packages/common/tests/forgeViews.test.ts › radical structure › makes a group of views of each state machine, process, system, container and domain, which a later element joins) passed
  test(apps/e2e/tests/studio/viewpoints.spec.ts › a viewpoint that draws one element makes a group with a view of each, which a new element joins) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/viewpoints.test.ts (a view kept to its element, following the viewpoint, Detach, its name following the element, deleted with it; groups made and removed with the elements; the five built-in viewpoints of one element; create_view, delete_view, update_view and upsert_viewpoint with groups and subjectTypes), packages/common/tests/forgeViews.test.ts (Forge makes the groups) and apps/e2e/tests/studio/viewpoints.spec.ts (a group in the list, a new element joining it).

Threshold: All pass in CI
