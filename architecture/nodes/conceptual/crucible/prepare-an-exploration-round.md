---
id: "565e5122-1760-436e-abc1-27ede4312bdc"
type: "requirement"
label: "Prepare an exploration round"
action: "the CLI shall build the project once at the commit with the builds crucible.json names, give each run its own folder, copy of the build and ports, number the runs after the last round's, and write the round's brief (the project's brief, the commit, the commits and the model elements changed since the last round's commit, the elements grouped as candidate areas, the open findings and questions, the setup, each server and its port, the rules, scripts naming no absolute path among them, and the form of the report), a prompt per run with its area and serve commands, and the round's journal, changing nothing in the repository but the rounds folder"
ears_type: "event-driven"
rationale: "A round started by hand took a build, a brief written anew, ports and folders chosen per agent; the brief and the areas come from what changed, in the code and in the model."
trigger: "the user runs radical explore prepare with the number of runs (and --areas, --since, --no-build)"
---
