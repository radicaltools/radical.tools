---
id: "d8f08835-4aab-4160-afb9-803595fd0460"
type: "requirement"
label: "Card re-routes relation"
action: "the relation's properties card shall offer in its Actions Change source… and Change destination… (listing only endpoints the metamodel allows, the list opening in the card, and asking the relation's type where the one it has does not fit the new end and several do, as dragging its end with the reconnect handle does) and Hide from view on a structure view, and Delete relation at its foot."
ears_type: "event-driven"
rationale: "Re-routing a relation keeps its label and properties instead of forcing delete-and-redraw. Its actions were a floating bar at the bottom of the canvas until 2026-10-22; they belong to the relation's card, as an element's do. Moving an end onto a pair where several types fit left the relation untyped without asking (round 170–175, 2026-10-22, F-0018). Evidence: packages/ui/src/components/SelectionActions.tsx (RelationActions), packages/ui/src/components/RightPanel.tsx, packages/common/src/model.ts (relationTypeOnMove), packages/ui/src/store/diagramStore.ts (moveRelationEnd); apps/e2e/tests/studio/properties-card.spec.ts; manual#relations"
trigger: "the user selects a single relation in the Designer perspective"
---
