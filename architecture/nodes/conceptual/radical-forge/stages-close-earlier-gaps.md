---
id: "5ee45d2e-340c-46b1-b898-4d05f9968fda"
type: "requirement"
label: "Stages close earlier gaps"
action: "Radical Forge shall propose adding or correcting that element, with the links its own stage would have given it (a new requirement derives from the need or a requirement and gets a scenario that verifies it), as long as the brief, the user's answers or the model already imply it; what would go beyond the brief it shall name in the stage summary as an open question instead of proposing it, and it shall not delete elements of earlier stages"
ears_type: "event-driven"
rationale: "Each stage looks at the model from another side: a process shows a missing step or actor, a state machine a missing timeout or cancel, a screen a field no entity holds, the C4 stage an asynchronous flow no requirement asks for. Before, a stage could create only its own types and these gaps were lost. Evidence: packages/common/src/ai/forge/prompts.ts (the gaps block of every stage from Domain model on); packages/common/tests/forgePrompts.test.ts"
trigger: "a Forge stage finds that what it models needs an element an earlier stage left out or got wrong (a requirement, a scenario, an entity, an event, a link between them)"
---
