---
id: "f170fe0f-f00e-4147-8eba-6428fe72e4c0"
type: "fitness-fn"
label: "Calm drag tests"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
metrics: |
  test(packages/ui/tests/calmDrag.test.ts) passed
  test(apps/mcp/src/folderModel.test.ts › long Smart Layout runs › unpins the view it lays out whole; round a selection the pinned elements stay, pinned) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a drag moves only the dragged node, and the drop pins it) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a drop onto a node pushes that node clear and nothing else) passed
  test(apps/e2e/tests/studio/physics.spec.ts › a drag with Cmd held lets the physics move the surroundings) passed
scope: "atomic"
trigger: "pull-request"
---

packages/ui/tests/calmDrag.test.ts (engine and store: a calm drag moves only the dragged element and its line partners, the drop pushes covered elements clear whole, pinned ones included (they stay pinned where they land), and moves the dropped element off one that lines hold on both axes, a click changes nothing, pins hold through physics runs, Smart Layout unpins in its undo step; apps/mcp/src/folderModel.test.ts: smart_layout unpins) and apps/e2e/tests/studio/physics.spec.ts (on a 225-node grid a drag moves only the dragged node and pins it; a drop onto a node moves just that node; a Cmd drag still moves the surroundings).

Threshold: Both suites pass in CI
