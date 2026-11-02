---
id: "b46b57f2-74bc-4cbe-a7ea-802bd1fee9dd"
type: "scenario"
label: "Live run feed"
given: "an AI run whose model answers with tool calls over two rounds"
then: "the listener gets a round event per round, an action per tool call labelled with the resolved element names, a failed action with ok false when a call errors, and a running token total after each round"
when: "the run is started with a progress listener, as a Forge stage is"
---
