---
id: "d622cf4f-ff24-4d2b-95f0-a7c3f17ba712"
type: "requirement"
label: "Lay out the visible graph"
action: "Smart Layout shall lay out only the elements visible in the active view, treat collapsed containers at their collapsed size, and attach relations of hidden children to their nearest visible ancestor."
ears_type: "ubiquitous"
rationale: "Optimising elements nobody sees would distort the picture the user actually looks at. Evidence: packages/layout/src/viewInput.ts:117-162; packages/layout/src/geometry.ts:96-143; packages/layout/src/smartLayout.ts:1094; packages/ui/src/store/diagramStore.ts:2876-2878; packages/layout/tests/smartLayout.test.ts:196-202; packages/layout/tests/layoutPipeline.test.ts:39-56; manual#layout"
---
