---
id: "7eff976f-5f58-4211-a0e8-fa7d66309f3a"
type: "requirement"
label: "Create with initial links"
action: "Studio shall create those relations together with the element, after its wizard finishes when the type has one."
ears_type: "event-driven"
rationale: "A child added from its parent's page must arrive already linked. Evidence: packages/ui/src/store/diagramStore.ts:1485-1501,1512-1521; packages/ui/src/components/WikiView.tsx:235-250; packages/ui/tests/nodeWizard.test.ts:76,94; manual#properties"
trigger: "an element is created with initial links, such as Add child on a wiki page"
---
