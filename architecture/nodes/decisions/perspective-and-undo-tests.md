---
id: "e4088b00-070d-436d-a233-cb6220aac3fe"
type: "fitness-fn"
label: "Perspective and undo tests"
category: "structural"
metrics: |
  test(packages/ui/tests/perspectiveMilestones.test.ts) passed
  test(packages/ui/tests/undoSteps.test.ts) passed
  test(apps/studio/tests/viewerSandbox.test.ts) passed
  test(apps/e2e/tests/studio/editing.spec.ts) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a milestone picked in Viewer is not the one Designer edits) passed
---

packages/ui/tests/perspectiveMilestones.test.ts (a milestone picked in Viewer, "Current (live)" picked in Viewer, Restore to live, slide cards after a milestone slide, undo and redo outside Designer), packages/ui/tests/undoSteps.test.ts (view and sequence edits as steps, Wrap into as one step, steps of a deleted type, Reset to C4 refused, a load during a drag), apps/studio/tests/viewerSandbox.test.ts (a slide added in Presenter on a milestone saves the live model) and apps/e2e/tests/studio (editing.spec.ts: the undo keys in a text field, in Viewer and in Presenter; physics.spec.ts: a milestone picked in Viewer is not the one Designer edits).

Threshold: All suites pass in CI
