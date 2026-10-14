---
id: "99c8ed33-0e8a-45c5-8e75-daaa5a47f5db"
type: "fitness-fn"
label: "Inspector tests"
category: "structural"
tests: |
  apps/studio/tests/inspector.test.ts
  apps/e2e/tests/studio/inspector.spec.ts
threshold: "All suites pass in CI (npm test and the e2e suite)"
---

apps/studio/tests/inspector.test.ts: the perspective parks the model and gives it back, takes no undo step, and going to an element picks the canvas or wiki view that shows it. apps/e2e/tests/studio/inspector.spec.ts: on a folder model the button is greyed out until .radical/test-results.json appears, the page shows the failed test and what it leaves unverified, the link opens the element's panel, Show on canvas goes to Designer on the view that shows it with the element selected, and a passing run clears the error.
