---
id: "81aeb9d5-a134-408a-9c36-91a5c341b015"
type: "requirement"
label: "Preview concept three ways"
action: "The Hub shall show the concept as a canvas, wiki or table, opening a single requirement, ADR or fitness function in the wiki and patterns, blueprints and concepts of several elements on the canvas, offer a selector for the concept's named views of the current mode, and keep the concept, mode and named view in the page link."
ears_type: "event-driven"
rationale: "Users judge a concept before importing it, rendered by the same engine as Studio. Evidence: apps/hub/src/HubApp.tsx:302-345,688-713; apps/hub/src/conceptToDiagram.ts; manual#hub"
trigger: "the user opens a concept from the catalogue or a link"
---
