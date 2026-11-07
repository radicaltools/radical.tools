---
id: "f0c66306-5dbc-45ea-8818-b00cc4f565ec"
type: "scenario"
label: "Transition evidence told apart"
given: "an Assay run with an order status set by code to paid but never to shipped"
then: "run.json marks the first sets and the second quoted, and the answer counts one of each"
when: "the agent applies a machine with transitions to paid (on the setting line) and to shipped (on a quotation)"
---
