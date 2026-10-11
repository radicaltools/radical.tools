---
id: "7655a26d-fae0-416e-9b3c-ec69c9dbed8c"
type: "requirement"
label: "Wizard prefill values"
action: "The system shall start it with the values its type's wizard prefills, turning \"{{today}}\" into the current date, so a new ADR starts as proposed with today's date."
ears_type: "event-driven"
rationale: "Sensible defaults save typing and keep dates consistent. Evidence: packages/common/src/metamodel/wizard.ts:48-60; packages/common/src/metamodel/presets/governance.ts:53; packages/common/tests/nodeWizard.test.ts:57-62; apps/e2e/tests/studio/wizard.spec.ts:22"
trigger: "a create-time wizard opens"
---
