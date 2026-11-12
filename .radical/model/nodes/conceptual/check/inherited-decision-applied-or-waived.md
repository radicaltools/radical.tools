---
id: "969000aa-9724-4b1c-9d22-2f8cd7622e76"
type: "requirement"
label: "Inherited decision applied or waived"
action: "it shall report an error naming the ADR and the model it comes from, and say how to apply it (constrains to the elements it governs) or waive it (an ADR of the model that waives it)"
ears_type: "event-driven"
rationale: "A group standard binds every system that depends on it; an exception is a decision of the system, recorded with its reasons."
trigger: "radical check or the Inspector checks a model that holds an accepted ADR fetched from a model it depends on, which constrains none of the model's own elements and which no accepted ADR of the model waives"
---
