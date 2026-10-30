---
id: "955627cc-64a4-4923-9062-cab714a7a508"
type: "scenario"
label: "Manage and filter models"
given: "a model kept in the browser is open"
metrics: "test(apps/e2e/tests/studio/boot.spec.ts › Models dialog › lists every model, filters them, and creates one with the welcome steps) passed"
then: "the list names This browser as the model's place, the new model uses the Radical metamodel by default and opens empty, the search keeps only the matching model, and the renamed model is listed under its new name"
when: "the user adds a model with + New model in Manage models, then searches the list and renames a model from its Actions menu"
---
