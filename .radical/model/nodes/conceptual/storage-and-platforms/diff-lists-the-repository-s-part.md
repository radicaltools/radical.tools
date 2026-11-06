---
id: "e2160d18-16f1-4ebe-b379-c490ad84005c"
type: "scenario"
label: "Diff lists the repository's part"
given: "a model in which, since the base, requirement A, satisfied by an element this repository builds, and requirement B, satisfied by an element it does not build, both changed; .radical/radical.json maps the first element"
then: "A is listed as changed, and B is not listed"
when: "radical diff runs with --part and --since the base"
---
