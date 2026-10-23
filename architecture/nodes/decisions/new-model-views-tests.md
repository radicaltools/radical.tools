---
id: "d05f4015-e4b1-4a70-95fa-d98fa429a200"
type: "fitness-fn"
label: "New model views tests"
category: "structural"
tests: |
  packages/common/tests/viewStructure.test.ts
  apps/e2e/tests/studio/boot.spec.ts
threshold: "Both suites pass in CI"
---

packages/common/tests/viewStructure.test.ts (metamodelViews: All elements first, a view of each chosen viewpoint in its folder and in the list's order, a group of views per element, only All elements for none). apps/e2e/tests/studio/boot.spec.ts (the New model step's Views choice, Customise…, Empty, and a new model opening on All elements, in the browser).
