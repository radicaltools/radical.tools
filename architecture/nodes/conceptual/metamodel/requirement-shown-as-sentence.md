---
id: "978944b2-a4b7-4fa3-8bd0-b64b7d243771"
type: "requirement"
label: "Requirement shown as sentence"
action: "The system shall show a requirement as the EARS sentence composed from its pattern, clauses and action, with placeholders for empty slots, on its canvas node (without Markdown marks) and in the properties panel, and in the table obligation first: who shall do what, up to the action's first phrase, then the condition it holds under (the {obligation} and {condition} tokens of its type's summary template), with the whole sentence in the tooltip."
ears_type: "ubiquitous"
rationale: "People review requirements as sentences, not as separate fields; on one line of a table the start has to say what is required, since the end gets cut off. Evidence: packages/common/src/metamodel/ears.ts (composeEarsSentence, earsSummaryParts); packages/ui/src/components/nodes/C4Nodes.tsx; packages/ui/src/components/RightPanel.tsx; packages/common/src/nodeSummary.ts (nodeSummary, nodeSummaryDetail); packages/common/tests/earsSentence.test.ts; packages/common/tests/nodeSummary.test.ts; manual#properties"
---
