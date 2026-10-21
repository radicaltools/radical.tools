---
id: "2e2bef03-28ec-4104-97b1-5b330ffbf8f1"
type: "requirement"
label: "Explore from the model"
action: "the system shall brief each exploratory agent from the model (the areas changed since the last round, the requirements and ADRs they touch, the known findings and the decisions not to report again), give the runs disjoint areas and isolated servers, folders and copies of models, require a reproduction script and a screenshot per finding, re-run every finding before it reports it, search each finding's pattern in other places, and list the questions for a person apart from the bugs"
ears_type: "event-driven"
rationale: "Exploratory rounds 1 to 69 found about 250 bugs no test described; the setup, the re-runs and the sibling search were done by hand each round."
trigger: "the user starts radical explore with a number of runs"
---
