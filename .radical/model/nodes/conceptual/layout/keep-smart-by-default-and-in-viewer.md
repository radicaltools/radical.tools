---
id: "63f73cff-9e81-487c-abdc-bd6ae6a04df3"
type: "scenario"
label: "Keep smart by default and in Viewer"
given: "a static view with no Keep smart setting of its own, and another with Keep smart off saved with it"
then: "the first view is tidied after the add and the second is not; the switch in Designer saves off with the first view, which then stays as it is whatever the default; in Viewer the view is tidied after the agent's add, and back in Designer the view's saved setting is off again and the model saved nothing of Viewer's switch or layout"
when: "the user turns the Keep smart default on in Settings, an element is added to each view, the user switches Keep smart off on the first view, then opens Viewer, switches Keep smart on there, an agent adds an element, and the user goes back to Designer"
---
