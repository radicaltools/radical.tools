---
id: "4995dfba-819c-455c-a6e1-bd34867d2040"
type: "scenario"
label: "Forge stores brief as need"
given: "a governance model with no needs and AI configured"
tests: "apps/e2e/tests/studio/need.spec.ts › on the governance bookstore › Radical Forge stores its description as a Need and offers existing Needs as input"
then: "the model has one need labelled \"Click & collect\" holding the full brief, with source \"Radical Forge\""
when: "the user types a brief headed \"# Click & collect\" in Radical Forge and presses Start"
---
