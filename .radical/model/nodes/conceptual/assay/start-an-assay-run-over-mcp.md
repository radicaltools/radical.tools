---
id: "648c3c4c-96a7-42dc-99af-9941090d6183"
type: "requirement"
label: "Start an Assay run over MCP"
action: "the MCP server shall read and link their facts, keep the run, and return what it found per repository and the procedure: the C4 stage, then the scenarios stage, each handed back as a plan"
ears_type: "event-driven"
rationale: "All of Assay is available over MCP, as Forge is (need Radical Assay: \"it has to be available from MCP\")."
trigger: "an agent calls assay_start with the directories of the code repositories"
---
