---
id: "f63e9415-f5a7-41db-8a05-4c70c4a7732d"
type: "requirement"
label: "Reset refused when used"
action: "refuse the reset, keep the current metamodel and every element, and say why the metamodel cannot be reset"
ears_type: "unwanted-behaviour"
rationale: "The reset went through and left the governance elements as unknown types, with nothing in the editor to bring the types back. Evidence: apps/e2e/tests/studio/metamodel-editor.spec.ts"
unwanted_condition: "the user confirms Reset to C4 preset while the model or a milestone holds elements or relations of types the C4 preset does not define, or a view's filter names such a type"
---
