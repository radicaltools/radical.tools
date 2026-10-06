---
id: "bdcc2573-2424-464e-b160-508cfdc24124"
type: "requirement"
label: "Metamodel-driven property form"
action: "the right panel shall show its label, the properties its node type defines in the metamodel (omitting fields whose visibleWhen condition is not met) and a Parent selector limited to allowed parent types."
ears_type: "event-driven"
rationale: "Forms that follow the metamodel let custom types get their own fields without code changes. Evidence: packages/ui/src/components/RightPanel.tsx:1626-1700,1775-1840; packages/ui/tests/model.test.ts:114; manual#properties; manual#elements"
trigger: "the user selects an element"
---
