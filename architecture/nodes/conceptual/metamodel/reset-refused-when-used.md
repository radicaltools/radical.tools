---
id: "252411eb-cfef-410b-9adb-87f5454046b8"
type: "scenario"
label: "Reset refused when used"
given: "a model with a state machine and other elements the C4 preset has no type for; another model whose live elements all have a C4 type while a milestone holds an element of a type C4 lacks, or a view's filter names one"
tests: |
  apps/e2e/tests/studio/metamodel-editor.spec.ts › Reset to C4 preset is refused while the model holds what C4 has no type for
  packages/common/tests/relationEndpoints.test.ts › replacing the metamodel › is refused while a milestone holds what the new one has no type for, or a view names it
  packages/ui/tests/typesInUse.test.ts › Reset to C4 › is refused while a milestone holds an element of a type C4 does not have
then: "Studio says it cannot reset the metamodel, naming the milestone or view to change first, the editor lists no issues and the canvas keeps every element"
when: "the user confirms Reset to C4 preset in the metamodel editor"
---
