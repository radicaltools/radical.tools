---
id: "b4439db7-fc44-49fb-8036-07aa2954f838"
type: "component"
label: "Concept-to-model mapper"
technology: "TypeScript"
---

apps/hub/src/conceptToDiagram.ts. Turns a Hub concept into a model with the governance metamodel, the concept's own named views, sequences whose relations all exist, and synthetic wiki and table views. Fills {{KEY}} placeholders with each parameter's default (or hint) but keeps the {{ }} around it, and lays the canvas out from a named view's stored positions when one is chosen. Picks the mode a concept opens in.
