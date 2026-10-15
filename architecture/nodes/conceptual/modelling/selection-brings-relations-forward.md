---
id: "e5dd585c-2bb1-4f19-a1f2-2b53530adbd0"
type: "requirement"
label: "Selection brings relations forward"
action: "the canvas shall draw the selection, the relations from and to it or to anything inside it, the elements at their other ends and the containers they sit in as they are, draw those relations in the accent colour and dim every other element, relation and relation label the canvas shows until the selection is cleared; when the selection was made by a click on the canvas, the camera shall frame the selection with the elements at the other ends (zooming in to at most 120 %), and a click on the empty canvas shall bring back the camera from before unless the user moved it since."
ears_type: "event-driven"
rationale: "On a large view the relations of one element are lost among all the others; the metamodel diagram already focuses and frames a selected type this way. The focus is computed once per change of the selection or the canvas; dimmed cards get a CSS class on an object kept per node, so no card re-renders, and opacity only (no filter) keeps panning fast. Only clicks on the canvas move the camera: Quick Search, a view switch or a slide that selects set their own, and a presentation never frames. Evidence: packages/ui/src/store/canvasFocus.ts, packages/ui/src/components/Canvas.tsx (focusDimmed, frameSelection, frameNodes), packages/ui/src/components/edges/RelationEdge.tsx (edgeFocus), packages/ui/src/index.css (.focus-dim), packages/ui/tests/canvasFocus.test.ts, apps/e2e/tests/studio/selection-focus.spec.ts"
trigger: "the user selects one or more elements, or a relation, on a canvas"
---
