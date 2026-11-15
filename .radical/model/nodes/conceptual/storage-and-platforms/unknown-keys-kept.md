---
id: "7e1443cc-0e38-4f60-8d2d-dd41e800fefe"
type: "scenario"
label: "Unknown keys kept"
given: "a .radical/radical.json with keys of its own at the top, in tests and on an entry"
then: "the file keeps every key it did not know, and the changed entry keeps its other keys"
when: "radical implement writes an entry, and the file is read and written again"
---
