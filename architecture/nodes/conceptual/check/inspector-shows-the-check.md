---
id: "8a276a1a-bb87-49ae-9325-34bddce6a6a7"
type: "requirement"
label: "Inspector shows the check"
action: "show what radical check says about the model as it is now in a Model quality tab (consistency, completeness, traceability and decisions, each as strong as its weakest metric, the chain from needs to tests, gaps by group, goals and baselines, findings by dimension) and an Implementation tab (what the last check report says: requirements and accepted ADRs verified, named tests passing, tests the model names, what falls out at each step, coverage by architecture element, the checks that do not pass and what they leave unverified, how old the results are), and make every element it names a link to that element"
ears_type: "event-driven"
rationale: "The report becomes something a person reads and acts on, not a CI log: how good the model is, and how faithfully the implementation follows it. Evidence: apps/studio/src/renderer/src/components/Inspector.tsx, components/inspector/ModelTab.tsx, ImplementationTab.tsx, shared.tsx, persistence/inspector.ts"
trigger: "the user opens the Inspector perspective"
---
