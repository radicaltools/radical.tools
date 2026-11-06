---
id: "06d75e4b-2ddb-4ac5-83ce-6739b4d23bb0"
type: "scenario"
label: "Part's removed element listed"
given: "a model in which requirement A, satisfied by an element this repository builds at the base, was deleted since"
then: "A is listed as removed"
when: "radical diff runs with --part and --since the base"
---
