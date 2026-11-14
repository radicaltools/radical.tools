---
id: "d8855f50-3960-4168-a91f-5e0ccb420f6e"
type: "requirement"
label: "Inherited decision checked"
action: "it shall report an error on that element naming the ADR and the model it comes from, and say that a fitness function implementing the ADR must check it"
ears_type: "event-driven"
rationale: "A standard applied but not tested is a claim nobody verifies."
trigger: "radical check or the Inspector checks a model in which an accepted ADR fetched from a model it depends on constrains one of the model's own elements, and no fitness function that implements the ADR, the model's own or fetched, names a check (metric conditions or tests the repository binds to it)"
---
