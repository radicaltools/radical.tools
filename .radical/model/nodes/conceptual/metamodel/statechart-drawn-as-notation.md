---
id: "c541d4a4-32e4-4481-b221-e6d4ac945338"
type: "scenario"
label: "Statechart drawn as notation"
given: "an order state machine, the lifecycle of the Order entity, with a transition that has an event, a guard, an action and a raised event"
then: "the machine is headed State machine · Order and the transition reads PaymentReceived [ok] / reserve ^OrderPaid by the events' current names; the transition's card is titled as its line, and Event (none) stores no event; an event's summary says which transitions raise it"
when: "it is shown on the canvas and the event is renamed"
---
