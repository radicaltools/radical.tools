---
id: "1b2f3ecc-0906-4b58-867f-12d30819c8e7"
type: "requirement"
label: "Gap report after each stage"
action: "Radical Forge shall list the gaps the model has by the completeness rules that apply once that stage is done (a requirement with no origin or no scenario after the scenarios, a fitness function without a threshold, an event no transition uses, and after C4 a requirement nothing satisfies, a step nobody performs, a screen no front-end presents, a state machine nothing implements), show them to the user and give them to the next stage to close"
ears_type: "event-driven"
rationale: "A prompt alone finds gaps by chance; the rules of radical check find the traceability gaps every time, and running them only for the stages that are done keeps out gaps that a later stage closes by design. Evidence: packages/common/src/ai/forge/refinements.ts (forgeGaps); packages/common/src/check/rules.ts; packages/common/tests/forgeRefinements.test.ts"
trigger: "a Forge stage has finished"
---
