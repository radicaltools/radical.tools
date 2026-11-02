---
id: "b6448dcc-dfe9-489c-aafa-dc28c3c29c9c"
type: "scenario"
label: "Component refused at root"
gherkin: "# Not covered by an automated test"
given: "a C4 model is open"
then: "no node is created and a message says a Component must be placed inside a Container, Web App or Group"
when: "the user drops a Component on the empty canvas"
---
