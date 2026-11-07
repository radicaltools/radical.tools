---
id: "5156b25a-1b54-494b-b089-2286c203c88b"
type: "requirement"
label: "Processes from entry points"
action: "the MCP server shall write each process with its steps in order directly into the model as inferred (no proposal), each step citing the entry point, explored path, screen or quoted code it rests on (a step made of steps may rest on them alone), performed by the person or element the plan names and illustrated by the mockups it names, and refuse a step that rests on nothing"
ears_type: "event-driven"
rationale: "A process read from the code is a reading of it, to be reviewed in the model; asking about each step would bury the user."
trigger: "an agent applies a plan with processes during an Assay run"
---
