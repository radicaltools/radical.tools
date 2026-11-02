---
id: "3421e382-a226-494c-b39f-91d82af85379"
type: "requirement"
label: "Need keeps raw text"
action: "The governance preset shall define the Need type with its free text as the description, a kind (brief, user story, stakeholder note, meeting notes, regulation, other; default brief) and a source, and with no status."
ears_type: "ubiquitous"
rationale: "Stakeholder input is kept verbatim; being in the model means it is accepted. Evidence: packages/common/src/metamodel/presets/governance.ts:118-159; packages/common/tests/needType.test.ts:8-15; apps/e2e/tests/studio/need.spec.ts:18-38; manual#properties"
---
