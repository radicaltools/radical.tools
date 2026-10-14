---
id: "6d6844dc-3456-4ca4-8aa7-38f410282ef9"
type: "requirement"
label: "Presets refresh on load"
action: "The system shall replace the stored metamodel with the current version of that preset."
ears_type: "event-driven"
rationale: "Models pick up new types and rules shipped with new versions without migration; a document with no metamodel runs under C4. Evidence: packages/common/src/model.ts:37-46; packages/ui/src/store/diagramStore.ts:1276-1283; apps/e2e/tests/studio/metamodel-diagram.spec.ts:5-9; manual#metamodel"
trigger: "a document whose metamodel is an unmodified built-in preset is loaded"
---
