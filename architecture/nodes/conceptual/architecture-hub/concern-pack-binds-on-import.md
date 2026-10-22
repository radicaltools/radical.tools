---
id: "5b7eedf4-c138-45d6-94c9-cd968c2bea5b"
type: "requirement"
label: "Concern pack binds on import"
action: "add the part of the pack's slice its answers pick, with its relations and its texts filled from the answers, make its ADR and fitness functions constrain each element and each element satisfy the pack's requirements, import it unbound when no element is given, and refuse an element that is not one the metamodel lets constrain and satisfy, or an answer that is none of a question's options"
ears_type: "event-driven"
rationale: "Bound, the slice passes radical check apart from the tests still to write, and the concern it covers is addressed; unbound (Radical Forge before its C4 stage), concern-unbound keeps it in sight until it is bound. ADR Hub concern packs and critic."
trigger: "an agent calls forge_import_hub_concept with a concern pack, the answers to its questions and the ids of the elements to bind it to, or none"
---
