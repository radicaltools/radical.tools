---
id: "2eae0705-784c-4699-a156-f9d6465e66ed"
type: "requirement"
label: "Lines judged along their orthogonal route"
action: "Smart Layout shall judge crossings, elements covered and bends along the route Studio draws (out of each side, then an L or a Z between the ports), counting each bend as a cost."
ears_type: "event-driven"
rationale: "A straight segment between the ports is not what an orthogonal view shows; its route crosses and covers other things."
trigger: "a view draws its lines orthogonally"
---
