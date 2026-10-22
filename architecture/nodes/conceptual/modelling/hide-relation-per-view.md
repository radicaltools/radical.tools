---
id: "0d35fb32-107c-4429-8b48-51007268c0ba"
type: "requirement"
label: "Hide relation per view"
action: "Studio shall hide that relation in the active view only while keeping it in the model and in every other view."
ears_type: "event-driven"
rationale: "Noisy edges can be removed from one diagram without losing the dependency. Evidence: packages/ui/src/components/SelectionActions.tsx (RelationActions); packages/ui/src/store/diagramStore.ts (hideRelationFromView); packages/ui/src/components/RightPanel.tsx; apps/e2e/tests/studio/properties-card.spec.ts; manual#views"
trigger: "the user chooses Hide from view on a relation"
---
