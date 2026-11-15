---
id: "f5b72a9c-6238-446b-bc89-37d98d5e162c"
type: "requirement"
label: "Agent finishes a Forge run"
action: "report for each stage what it added, that it was skipped with the reason, only for a stage left out with forge_skip_stage, or else that it was not run, show the same in the run's status Studio reads, with no stage still asking questions once the run is finished, and build Gherkin .feature files from the model's scenarios, writing them into the folder the agent names or returning their contents"
ears_type: "event-driven"
rationale: "The agent's equivalent of the wizard's Finish step. forge_finish called a stage neither run nor skipped skipped, while the run's status had it pending (F-0112, round 201–210; the maintainer's decision: such a stage is not run). Evidence: apps/mcp/src/forge.ts (finish), packages/common/src/formats/exportGherkin.ts (buildGherkinFiles), apps/mcp/src/forge.test.ts › draws wireframes, imports Hub concepts and exports the Gherkin files"
trigger: "an agent calls forge_finish"
---
