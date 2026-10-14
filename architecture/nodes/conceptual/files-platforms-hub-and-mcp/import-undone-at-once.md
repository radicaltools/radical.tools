---
id: "7cda471f-bda8-40a8-b4d0-0af95cb42952"
type: "scenario"
label: "Import undone at once"
given: "a model is open on a view"
tests: "apps/e2e/tests/studio/hub-import.spec.ts › a concept added with its related concepts is one undo step"
then: "three elements come in, and one undo removes them all"
when: "the user imports API Response Time with its related concepts and presses ⌘/Ctrl+Z"
---
