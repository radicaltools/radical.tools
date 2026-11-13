---
id: "543da4c0-8950-46f6-8f6b-4b6b9048d94e"
type: "requirement"
label: "Imported relations keep their properties"
action: "the system shall copy each of its relations with the relation's own properties (a derives relation's quote, a transition's event and guard), under new ids"
ears_type: "event-driven"
rationale: "A concern pack's requirements quote its need; dropped on import, every quote became a derives-quote-missing warning, and a state machine's transitions lost their triggers."
trigger: "a Hub concept is added to the model"
---
