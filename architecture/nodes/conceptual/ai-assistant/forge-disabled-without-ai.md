---
id: "8b428a8f-4da5-42dc-b22b-0809c55c4207"
type: "scenario"
label: "Forge disabled without AI"
given: "Studio with no AI provider set up"
tests: "apps/e2e/tests/studio/forge.spec.ts › without an AI provider Radical Forge is offered disabled, with how to set one up, and asks nothing"
then: "Radical Forge is offered disabled, saying how to set an AI provider up; clicking it asks nothing, saves nothing and sends no request"
when: "the user opens AI on the activity rail and looks at the Forge button of the Quick Search bar"
---
