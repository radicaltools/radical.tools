---
id: "301f1c21-bd6b-46c6-a774-6164cee4cbf4"
type: "requirement"
label: "Wizard on create"
action: "The system shall open that type's wizard and create the node, together with the relations picked in it, only when the user presses Create."
ears_type: "complex"
feature: "Wizard on create is switched on in the app menu"
rationale: "ADRs, fitness functions, needs, requirements, scenarios and mockups get guided entry, and abandoning the wizard leaves nothing behind. Evidence: packages/common/src/metamodel/types.ts:70-115; packages/common/src/metamodel/wizard.ts:35-46; packages/ui/src/store/diagramStore.ts:1485-1527; apps/studio/src/renderer/src/components/Toolbar.tsx:432-441; packages/common/src/metamodel/presets/governance.ts:51-70,101-115,160-172,210-228,332-346,425-437; apps/e2e/tests/studio/wizard.spec.ts:11-52; manual#properties"
trigger: "the user creates a node whose type defines a create-time wizard"
---
