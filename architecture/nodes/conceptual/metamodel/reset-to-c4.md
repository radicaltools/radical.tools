---
id: "cdcdbab0-4bc8-429e-9375-13f460882b12"
type: "scenario"
label: "Reset to C4"
given: "a model whose elements all have a type in the C4 preset"
tests: "packages/ui/tests/undoSteps.test.ts › Reset to C4 preset › goes through when every element has a type there, and forgets steps that do not"
then: "the reset goes through and the undo steps that need a type C4 lacks are dropped"
when: "the user resets the metamodel to the C4 preset"
---
