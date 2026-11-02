---
id: "cdcdbab0-4bc8-429e-9375-13f460882b12"
type: "scenario"
label: "Reset to C4"
given: "a model whose elements all have a type in the C4 preset"
then: "the reset goes through as one undo step, and Undo gives the metamodel of before back"
when: "the user resets the metamodel to the C4 preset"
---
