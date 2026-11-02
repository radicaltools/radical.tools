---
id: "bb877051-d43a-49bd-970c-d0f18e8589f6"
type: "requirement"
label: "No overlapping siblings"
action: "Smart Layout shall leave at least 40 px between root-level elements and at least 20 px between siblings inside a container."
ears_type: "ubiquitous"
rationale: "Overlapping boxes hide content and are the most visible failure of an auto-layout. Evidence: packages/layout/src/layoutFinalize.ts:15-18, packages/layout/src/layoutFinalize.ts:52-79, packages/layout/src/layoutFinalize.ts:117-120; packages/ui/src/store/diagramStore.ts:2893-2908; packages/layout/tests/smartLayout.test.ts:156-181; apps/e2e/tests/studio/layout.spec.ts:33-56; manual#layout"
---
