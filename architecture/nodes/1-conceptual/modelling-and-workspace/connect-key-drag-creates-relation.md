---
id: "85061442-a2cf-4110-ac0c-356abce02e48"
type: "requirement"
label: "Connect-key drag creates relation"
action: "Studio shall create a relation from the source to the target, with its relation type inferred from the metamodel."
ears_type: "event-driven"
rationale: "Connecting elements with one gesture, while a preview line follows the pointer, is how relations are drawn on the canvas. Evidence: packages/ui/src/components/Canvas.tsx:46-96,556-636,967-995; packages/common/src/model.ts:218-223; packages/ui/tests/connection.test.ts:34; manual#relations"
trigger: "the user holds the connect key, presses on a source node, drags and releases on a different node"
---
