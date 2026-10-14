---
id: "1dce69f9-c41b-482a-a750-883896f1d9c0"
type: "scenario"
label: "Removed element leaves views"
given: "an element listed in views"
tests: |
  packages/ui/tests/model.test.ts › removeNode › removes the node from every view nodeIds list
  packages/common/tests/modelFacade.test.ts › createModelFacade › removing a node removes its descendants, their relations and view references
then: "it and its descendants are gone from every view's element list, with their relations"
when: "it is removed from the model"
---
