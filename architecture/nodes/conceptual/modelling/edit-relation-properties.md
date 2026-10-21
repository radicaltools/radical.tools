---
id: "b88cec32-1d57-464a-ae51-a1d5399b08bd"
type: "requirement"
label: "Edit relation properties"
action: "the properties card shall let the user edit its label as the card's title, show its two ends as links that select them, and let the user edit the fields its relation type defines (Technology for untyped relations) and, when several types fit the endpoints, its relation type; the wiki's relation editor shall offer the same types, those that fit its two ends, never none."
ears_type: "event-driven"
rationale: "A relation carries meaning (protocol, intent) that belongs in the model, not only in the drawing. Evidence: packages/ui/src/components/RightPanel.tsx (PropertiesContent, PanelHeader, AttrRow); apps/e2e/tests/studio/runs-13-24.spec.ts; apps/e2e/tests/studio/matrix.spec.ts; manual#relations"
trigger: "the user selects a relation"
---
