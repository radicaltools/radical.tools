---
id: "edbf0f54-0ada-45e8-b351-d745ad125928"
type: "requirement"
label: "Derived items as children"
action: "The system shall show the nodes of that type that derive from a node as its children in the type's Table View tree and under \"Derives from this\" on its Wiki page, and Add child there shall create the child already linked."
ears_type: "optional"
feature: "a node type declares a hierarchy relation, as Need and Requirement do with Derives from"
rationale: "Nesting by relation lets needs and requirements form a tree without canvas containment. Evidence: packages/common/src/metamodel/types.ts:57-65; packages/common/src/metamodel/presets/governance.ts:156-158,208; packages/ui/src/components/TableView.tsx:240-260; packages/ui/src/components/WikiView.tsx:800-840,1120-1135; apps/e2e/tests/studio/need.spec.ts:79-123; manual#properties"
---
