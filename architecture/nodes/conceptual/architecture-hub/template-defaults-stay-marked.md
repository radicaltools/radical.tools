---
id: "f406e2c0-8c4e-4f57-966a-4da026dac867"
type: "requirement"
label: "Template defaults stay marked"
action: "The Hub shall show each {{KEY}} placeholder filled with the parameter's default value, or its hint when there is no default, still inside {{ }}, and leave a placeholder with neither as {{KEY}}."
ears_type: "state-driven"
precondition: "a concept with template parameters is shown in the Hub"
rationale: "Readers can tell a fill-in default from fixed prose; Studio's import asks for the real values. Evidence: apps/hub/src/conceptToDiagram.ts (substituteTemplateDefaults), apps/hub/tests/hubViewer.test.ts"
---
