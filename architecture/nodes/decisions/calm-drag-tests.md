---
id: "f170fe0f-f00e-4147-8eba-6428fe72e4c0"
type: "fitness-fn"
label: "Calm drag tests"
category: "structural"
threshold: "Both suites pass in CI"
---

packages/ui/tests/calmDrag.test.ts (engine and store: a calm drag moves only the dragged element and its line partners, the drop pushes covered elements clear whole, pinned ones included (they stay pinned where they land), and moves the dropped element off one that lines hold on both axes, a click changes nothing, pins hold through physics runs, Smart Layout unpins in its undo step; apps/mcp/src/folderModel.test.ts: smart_layout unpins) and apps/e2e/tests/studio/physics.spec.ts (on a 225-node grid a drag moves only the dragged node and pins it; a drop onto a node moves just that node; a Cmd drag still moves the surroundings).
