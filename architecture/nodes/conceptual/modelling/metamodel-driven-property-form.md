---
id: "bdcc2573-2424-464e-b160-508cfdc24124"
type: "requirement"
label: "Metamodel-driven property form"
action: "the properties card shall show its name as the title, the elements it sits in as links, the properties its node type defines in the metamodel (omitting fields whose visibleWhen condition is not met), short ones as rows of name and value and long ones as sections under them, and a Parent selector limited to allowed parent types."
ears_type: "event-driven"
rationale: "Forms that follow the metamodel let custom types get their own fields without code changes. Evidence: packages/ui/src/components/RightPanel.tsx (PropertiesContent, AttrValue, MarkdownField); packages/ui/tests/model.test.ts:114; apps/e2e/tests/studio/editing.spec.ts; manual#properties; manual#elements"
trigger: "the user selects an element"
---
