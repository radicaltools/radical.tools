---
id: "b88cec32-1d57-464a-ae51-a1d5399b08bd"
type: "requirement"
label: "Edit relation properties"
action: "the right panel shall let the user edit its label, the fields its relation type defines (Technology for untyped relations) and, when several types fit the endpoints, its relation type."
ears_type: "event-driven"
rationale: "A relation carries meaning (protocol, intent) that belongs in the model, not only in the drawing. Evidence: packages/ui/src/components/RightPanel.tsx:1886-2000; manual#relations"
trigger: "the user selects a relation"
---
