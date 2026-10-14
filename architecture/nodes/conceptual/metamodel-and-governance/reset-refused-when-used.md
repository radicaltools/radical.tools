---
id: "252411eb-cfef-410b-9adb-87f5454046b8"
type: "scenario"
label: "Reset refused when used"
given: "a model with a state machine and other elements the C4 preset has no type for"
tests: "apps/e2e/tests/studio/metamodel-editor.spec.ts › Reset to C4 preset is refused while the model holds what C4 has no type for"
then: "Studio says it cannot reset the metamodel, the editor lists no issues and the canvas keeps every element"
when: "the user confirms Reset to C4 preset in the metamodel editor"
---
