---
id: "98dc16db-3055-40d0-b1b0-384cfa9f9183"
type: "requirement"
label: "Containers wrap their children"
action: "Smart Layout shall resize every expanded container to wrap its visible children, with 120 px header room above them and a margin on the other sides, never below the container type's minimum size."
ears_type: "ubiquitous"
rationale: "Children must stay inside their parent and the parent must not waste space, otherwise the C4 nesting reads wrong. Evidence: packages/layout/src/layoutFinalize.ts:91-116; packages/layout/src/geometry.ts:30-62; packages/layout/src/viewInput.ts:157-184; packages/ui/src/store/diagramStore.ts:2891, packages/ui/src/store/diagramStore.ts:2740-2760; packages/layout/tests/layoutPipeline.test.ts:76-100; manual#layout; README (compound parent fitting)"
---
