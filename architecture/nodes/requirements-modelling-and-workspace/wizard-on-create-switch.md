---
id: "b7216ca7-f9f9-4c54-a308-20e61f79be4e"
type: "requirement"
label: "Wizard on create switch"
action: "Studio shall create new elements immediately without opening their wizard."
ears_type: "optional"
feature: "Wizard on create is turned off in the Radical menu"
rationale: "Experienced users who add many elements need to skip the guided form. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx:431-442; packages/ui/src/studioSettings.ts:19-35; packages/ui/src/store/diagramStore.ts:1488; packages/ui/tests/nodeWizard.test.ts:68; manual#properties"
---
