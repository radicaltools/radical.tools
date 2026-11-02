---
id: "bdc8ebef-332a-4784-a5b5-a5121a9b8c22"
type: "scenario"
label: "Transition events by reference"
given: "a transition labelled \"PaymentReceived [ok] / reserve ^OrderPaid\""
metrics: "test(apps/e2e/tests/studio/state-machines.spec.ts › a transition shows its events by name and picks them by reference) passed"
then: "the label reads \"Cancel [ok] / reserve\", the transition stores the event's id and no raised events, and after the rename it reads \"CancelOrder [ok] / reserve\""
when: "the user selects it, picks Cancel as its trigger event, removes OrderPaid, then renames the Cancel event to CancelOrder"
---
