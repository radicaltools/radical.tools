---
id: "99c8ed33-0e8a-45c5-8e75-daaa5a47f5db"
type: "fitness-fn"
label: "Inspector tests"
category: "structural"
tests: |
  apps/studio/tests/inspector.test.ts
  apps/studio/tests/inspectorSettings.test.ts
  apps/e2e/tests/studio/inspector.spec.ts
threshold: "All suites pass in CI (npm test and the e2e suite)"
---

apps/studio/tests/inspector.test.ts: the perspective parks the model and gives it back, takes no undo step, and going to an element picks the canvas or wiki view that shows it. apps/studio/tests/inspectorSettings.test.ts: Settings keep check.json as it was where nothing changed, add and remove baselines, goals and test-unbound files, and show a change as a line diff. apps/e2e/tests/studio/inspector.spec.ts: on a folder model the button is greyed out until .radical/test-results.json appears, Implementation shows the failed test and what it leaves unverified, the link opens the element's panel, Show on canvas goes to Designer on the view that shows it with the element selected, a passing run clears the error, and Settings flag a loosening change, ratchet, and save goals and rules to check.json.
