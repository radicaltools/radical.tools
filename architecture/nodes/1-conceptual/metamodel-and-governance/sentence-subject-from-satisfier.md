---
id: "7bd1d938-c558-43fc-8db4-2df21761ac3b"
type: "requirement"
label: "Sentence subject from satisfier"
action: "The system shall use that element's label as the subject of the requirement's EARS sentence, and \"the system\" when nothing satisfies it."
ears_type: "event-driven"
rationale: "\"The Payment Service shall…\" reads better and is more precise than \"the system shall…\". Evidence: packages/common/src/metamodel/ears.ts:146-159; packages/ui/src/components/NodeWizard.tsx:442-443; packages/common/tests/earsSentence.test.ts:70-82; manual#properties"
trigger: "an element satisfies a requirement"
---
