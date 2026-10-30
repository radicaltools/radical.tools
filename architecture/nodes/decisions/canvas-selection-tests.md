---
id: "d8fafdce-845b-4f47-b15a-f44bed0d5f9e"
type: "fitness-fn"
label: "Canvas selection tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(apps/studio/tests/canvasSelection.test.ts) passed
  test(apps/studio/tests/webFolder.test.ts) passed
  test(apps/mcp/src/folderModel.test.ts › canvas selection) passed
scope: "atomic"
trigger: "pull-request"
---

apps/studio/tests/canvasSelection.test.ts (selecting nodes writes them and the view into the active folder; leaving the model clears it), apps/studio/tests/webFolder.test.ts (the browser writes .radical/selection.json with its .gitignore and the folder poll reports no model change) and apps/mcp/src/folderModel.test.ts › canvas selection (get_selection resolves the ids against the model, reports missing ones and an empty selection, and leaves the model files untouched).

Threshold: All three suites pass in CI
