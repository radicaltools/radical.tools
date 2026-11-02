---
id: "00909ac5-2274-4898-96c7-990e9c4801de"
type: "requirement"
label: "Labels follow the zoom"
action: "hide the relation labels except those of the selected element's relations, show the relation names again once zoomed in and their technology too at full zoom, and keep every label in an exported picture"
ears_type: "state-driven"
precondition: "the canvas is zoomed out too far for relation labels to be read"
rationale: "Unreadable labels only cover the diagram when zoomed out, but an exported picture is read at its own size. Evidence: apps/e2e/tests/studio/edge-labels.spec.ts, apps/e2e/tests/studio/export.spec.ts"
---
