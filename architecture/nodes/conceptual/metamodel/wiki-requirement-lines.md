---
id: "b6b4268a-e46e-482d-b6c9-a43b14204b70"
type: "scenario"
label: "Wiki requirement lines"
given: "an empty wiki view of a Radical model, which says where to start"
tests: "apps/e2e/tests/studio/wiki.spec.ts › writing in the wiki › requirements are written line by line and a pasted list is one for each line"
then: "each line becomes a requirement in the order written, named from its EARS action and shown with its sentence, and a line that is no EARS sentence is only named; the line keeps the focus; the pasted lines are shown before they are added, saved with their EARS fields, and one Undo takes them back"
when: "the user starts with Requirements, writes three lines each ended with Enter, then pastes a three-item list and adds it"
---
