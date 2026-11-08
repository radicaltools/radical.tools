---
id: "648c3c4c-96a7-42dc-99af-9941090d6183"
type: "requirement"
label: "Start an Assay run over MCP"
action: "the MCP server shall read and link their facts, keep the run, and return in at most 20 KB what it found per repository (the counts of its facts, its first units, its services and databases) and the links counted by kind, pointing at assay_facts for the rest and at assay_procedure for the steps, stage by stage, each handed back as a plan; assay_facts returns a page of at most 200 facts and about 20 KB, with where the next one starts"
ears_type: "event-driven"
rationale: "An agent client keeps a long tool result out of the conversation: measured on three repositories of microservices, a 52 KB answer to assay_start left the agent without the procedure."
trigger: "an agent calls assay_start with the directories of the code repositories"
---
