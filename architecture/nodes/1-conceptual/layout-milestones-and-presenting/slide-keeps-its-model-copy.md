---
id: "7e859a7f-3483-4bc5-889e-1c2de69bc988"
type: "scenario"
label: "Slide keeps its model copy"
gherkin: "# Covered by: packages/ui/tests/presentation.test.ts › modelSnapshot is independent of later live edits"
given: "the user added a slide in the Presenter perspective"
then: "the slide still holds the model as it was when added"
when: "the user later edits the live model"
---
