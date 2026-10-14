---
id: "83694a02-2a4f-46b6-a849-b859ac92d575"
type: "scenario"
label: "Blueprint without placeholders"
given: "a Radical model is open"
tests: "apps/e2e/tests/studio/hub-import.spec.ts › a blueprint leaves no {{KEY}} placeholder in the model"
then: "more than twenty elements come in, and no element, relation or sequence holds a {{KEY}} placeholder"
when: "the user imports the Fintech blueprint's elements without its referenced concepts and confirms the template form"
---
