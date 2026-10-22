---
id: "041ef604-3c32-4528-acad-15ff32cca3a8"
type: "scenario"
label: "Rules as test cases"
given: "Studio's store fuzz file with its three models"
tests: |
  packages/ui/tests/invariants.test.ts › the rules hold over random sequences of actions › on the bookstore model: undoRestores holds
  packages/ui/tests/invariants.test.ts › the rules hold over random sequences of actions › on the nested model: geometry holds
  packages/ui/tests/invariants.test.ts › the rules hold over random sequences of actions › on the sample model: reloadKeeps holds
then: "the report has a case per model and one per model and rule, each passed"
when: "the unit tests run with a JSON report"
---
