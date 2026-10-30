---
id: "f8795ea9-0fbb-4b75-8c3f-eb289e880567"
type: "fitness-fn"
label: "Model change tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
metrics: |
  test(packages/common/tests/modelChanges.test.ts › model changes) passed
  test(apps/cli/src/diff.test.ts › radical diff) passed
  test(apps/mcp/src/folderModel.test.ts › get_changes) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/modelChanges.test.ts › model changes (moving, resizing and folding every element is no change; old and new values, ancestors and relations of each change, removed elements with their relations as they were, long and multi-line texts). apps/cli/src/diff.test.ts › radical diff (in a real git repository: the branch's changes committed or not, --since HEAD, JSON, a folder the base did not have, exit 2 outside git and on an unknown or option-like ref). apps/mcp/src/folderModel.test.ts › get_changes (the list after agent edits and Smart Layout, nothing written).

Threshold: All three suites pass in CI
