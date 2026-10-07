---
id: "10e2526a-b37a-4c1e-86b7-d7d938ca64f7"
type: "requirement"
label: "C4 links back to spec"
action: "Radical Forge shall instruct the model to link each new element to the requirements it satisfies, each fitness function to the elements it constrains, and each mockup to the front-end that presents it."
ears_type: "event-driven"
rationale: "The generated architecture stays traceable to the spec it was derived from. Evidence: packages/common/src/ai/forge/prompts.ts:211-232; manual#forge"
trigger: "the C4 model stage runs"
---
