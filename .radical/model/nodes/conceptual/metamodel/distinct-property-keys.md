---
id: "685e5a06-ef77-4146-b553-bb39f42b3562"
type: "requirement"
label: "Distinct property keys"
action: "not give the property that key: key a newly added property apart from the others, and keep the previous key of a renamed one, saying that the key is a field every element has"
ears_type: "unwanted-behaviour"
rationale: "Two properties with one key edited one value, and a property keyed type edited the element's type from the properties panel. Evidence: apps/e2e/tests/studio/metamodel-editor.spec.ts"
unwanted_condition: "a property of a type would get the key of another property of that type or of a field every element has, such as type"
---
