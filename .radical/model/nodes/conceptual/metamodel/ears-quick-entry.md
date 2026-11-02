---
id: "1e7dacab-93d5-4418-b19a-03b316baf8c4"
type: "requirement"
label: "EARS quick entry"
action: "The system shall split the sentence at its last \"shall\" or \"must\", fill the action and the When/Whenever, While, If and Where clauses, and set the pattern to the single clause type found, complex for several, or ubiquitous for none."
ears_type: "event-driven"
rationale: "Typing one sentence is faster than picking a pattern and filling slots. Evidence: packages/common/src/metamodel/ears.ts:75-144; packages/ui/src/components/EarsQuickEntry.tsx:42-75; packages/common/tests/earsSentence.test.ts:84-156; manual#properties"
trigger: "the user types a requirement sentence into the EARS quick-entry box and presses Enter"
---
