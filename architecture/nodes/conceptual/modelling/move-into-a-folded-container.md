---
id: "12ce904b-16a0-479c-8107-3fe2064957e8"
type: "scenario"
label: "Move into a folded container"
given: "a container folded on a view, or folded in the model, and an element outside it"
tests: |
  packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… a folded container
  apps/mcp/src/folderModel.test.ts › move_node into a folded container › places what lies outside it inside, beside what it holds (item 238)
then: "the element lies inside the container, beside what it holds, once it opens, and a reload draws it in the same place"
when: "the user moves the element into the container with Move to…, or an agent does with move_node, then expands the container and reloads"
---
