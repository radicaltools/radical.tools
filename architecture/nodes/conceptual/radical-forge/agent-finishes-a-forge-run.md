---
id: "f5b72a9c-6238-446b-bc89-37d98d5e162c"
type: "requirement"
label: "Agent finishes a Forge run"
action: "report for each stage what it added, or that it was skipped or begun but not completed, and build Gherkin .feature files from the model's scenarios, writing them into the folder the agent names or returning their contents"
ears_type: "event-driven"
rationale: "The agent's equivalent of the wizard's Finish step. Evidence: apps/mcp/src/forge.ts (finish), packages/common/src/formats/exportGherkin.ts (buildGherkinFiles), apps/mcp/src/forge.test.ts › draws wireframes, imports Hub concepts and exports the Gherkin files"
trigger: "an agent calls forge_finish"
---
