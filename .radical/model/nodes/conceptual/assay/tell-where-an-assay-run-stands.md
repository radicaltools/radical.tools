---
id: "f5f7cd11-2115-4632-8785-5bdf4e67cb80"
type: "requirement"
label: "Tell where an Assay run stands"
action: "the MCP server shall write where the run stands to .state/assay-run.json in the model folder: the repositories read with their units and facts, each stage (C4, Explore, Documents, Domain, Processes, State machines, Scenarios) pending, working, done or skipped with the plans applied and refused and the elements and relations added, the proposals waiting, accepted and rejected, and whether the run is active, finished or closed; it shall take the stage from the calls, a plan being of the latest stage its contents name, mark a stage the run moved past without a plan skipped, and close an unfinished run when its client goes away"
ears_type: "event-driven"
rationale: "The agent, not the server, follows Assay's stages (assay_procedure), so only the calls say where the run is; inferring the stage needs nothing of the agent, which could forget to report it (ADR Agent Assay runs show in Studio). Evidence: packages/common/src/formats/assayRunStatus.ts; apps/mcp/src/assay.ts (planStage, track, status); apps/mcp/src/folderModel.ts (writeAssayStatus, close)."
trigger: "an agent calls an assay_* tool"
---
