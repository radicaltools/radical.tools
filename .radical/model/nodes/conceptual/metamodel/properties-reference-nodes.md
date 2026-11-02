---
id: "9dd227e0-19e5-4cd3-8d19-ac6960163123"
type: "requirement"
label: "Properties reference nodes"
action: "The metamodel shall let a node or relation type define a reference property that points at one or several nodes of a given type by id, shown and picked by the nodes' labels, and the system shall warn when a reference points at no node or at a node of another type."
ears_type: "ubiquitous"
rationale: "A relation cannot point at a node, yet a transition must name its event; a reference keeps working when the event is renamed. Evidence: packages/common/src/metamodel/refs.ts; packages/common/src/metamodel/validate.ts; packages/common/src/ai/tools/propertyBag.ts; packages/ui/src/components/RefPicker.tsx; packages/common/tests/stateMachine.test.ts ('reference properties'); packages/common/tests/aiDocumentTools.test.ts ('reference properties through the tools'); apps/e2e/tests/studio/state-machines.spec.ts"
---
