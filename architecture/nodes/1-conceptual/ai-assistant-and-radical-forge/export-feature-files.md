---
id: "20097bd3-752a-4904-a7be-04a9059bfa0b"
type: "requirement"
label: "Export feature files"
action: "Radical Forge shall offer to export the scenarios as Gherkin .feature files, one file per verified requirement."
ears_type: "event-driven"
rationale: "Generated scenarios become executable test specs for the team. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:531-533,906-920; packages/common/src/formats/exportGherkin.ts:1-5,50-62; manual#forge"
trigger: "the Forge run reaches the Finish step and the model has scenarios"
---
