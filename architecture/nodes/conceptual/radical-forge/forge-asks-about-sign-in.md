---
id: "375cd06b-6dd2-400b-a82f-bed4dc68509e"
type: "scenario"
label: "Forge asks about sign-in"
given: "a governance model, AI configured and the Hub's concern packs loaded"
metrics: "test(apps/e2e/tests/studio/forge.spec.ts › Forge asks a concern pack's questions and imports it whole) passed"
then: "the stage card shows the pack's questions as choices under its name; after Confirm the model holds the pack's decision that nobody signs in, unbound"
when: "Radical Forge reaches the Requirements stage and the model picks the Authentication pack, the user answers that nobody signs in and confirms"
---
