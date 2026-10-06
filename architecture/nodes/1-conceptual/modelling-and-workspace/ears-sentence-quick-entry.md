---
id: "d9b85644-ed67-4cbb-b578-1e134d7eb706"
type: "requirement"
label: "EARS sentence quick entry"
action: "Studio shall parse it into the EARS pattern, the trigger or condition slots and the action, and fill the requirement with them."
ears_type: "event-driven"
rationale: "Writing a requirement as a sentence is faster than picking a pattern and filling slots. Evidence: packages/ui/src/components/EarsQuickEntry.tsx:42-72; packages/common/src/metamodel/ears.ts:98-145; packages/common/tests/earsSentence.test.ts:84-98; manual#properties"
trigger: "the user types a requirement sentence in the EARS quick-entry box and presses Enter"
---
