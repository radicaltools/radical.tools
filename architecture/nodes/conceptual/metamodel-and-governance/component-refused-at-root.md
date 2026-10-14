---
id: "b6448dcc-dfe9-489c-aafa-dc28c3c29c9c"
type: "scenario"
label: "Component refused at root"
gherkin: "# Not covered by an automated test"
given: "a C4 model is open"
tests: |
  packages/common/tests/c4Containment.test.ts › what a group may hold › anything but a group follows its allowed parents alone
  packages/common/tests/modelFacade.test.ts › createModelFacade › refuses placements the metamodel forbids, with the reason
then: "no node is created and a message says a Component must be placed inside a Container, Web App or Group"
when: "the user drops a Component on the empty canvas"
---
