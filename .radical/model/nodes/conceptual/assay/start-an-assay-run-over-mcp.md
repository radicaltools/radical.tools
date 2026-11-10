---
id: "648c3c4c-96a7-42dc-99af-9941090d6183"
type: "requirement"
label: "Start an Assay run over MCP"
action: "the MCP server shall read and link their facts, keep the run, and return in at most 20 KB what it found per repository (the counts of its facts, a stored package's members counted apart as they are in its row, its first units, its services and databases) and the links counted by kind, pointing at assay_facts for the rest and at assay_procedure for the steps, stage by stage, each handed back as a plan; assay_facts returns a page of at most 200 facts and about 20 KB, with where the next one starts; stored routines come with a package's members folded into its row, each by its id, name, kind and line with the tables and routines it uses; assay_procedure makes a stored package a component of the database element that holds it, its members named in its description, the code calling a member a relation to that component, and one package calling another a relation between their components; a database built from units of stack sql is observed; a deployed service of role other with no unit is a container where it is in the requests' path or uses a database; a scenario of a package's code goes to the unit whose scripts create it; the domain stage names the stored routines that use an entity's tables no unit's code names and no element holds"
ears_type: "event-driven"
rationale: "An agent client keeps a long tool result out of the conversation: measured on three repositories of microservices, a 52 KB answer to assay_start left the agent without the procedure."
trigger: "an agent calls assay_start with the directories of the code repositories"
---
