---
id: "8a276a1a-bb87-49ae-9325-34bddce6a6a7"
type: "requirement"
label: "Inspector shows the check"
action: "show what radical check says about the model as it is now, opening on an Overview tab (a row of scores: consistency, completeness, traceability and decisions, each as strong as its weakest metric, and requirements verified, decisions verified and named tests passing, each with its goal; then what needs attention), a Model tab (the chain from needs to tests, gaps by group, goals and baselines, findings by dimension), an Implementation tab (what the last check report says: what falls out at each step, coverage by architecture element, the checks that do not pass and what they leave unverified), a This branch tab and a Settings tab, and make every element it names a link to that element"
ears_type: "event-driven"
rationale: "The report becomes something a person reads and acts on, not a CI log: how good the model is, and how faithfully the implementation follows it. The Overview puts what to do first; the user found the tabs hard to read, with what needed fixing under tiles and funnels (2026-10-31). Evidence: apps/studio/src/renderer/src/components/Inspector.tsx, components/inspector/OverviewTab.tsx, ModelTab.tsx, ImplementationTab.tsx, BranchTab.tsx, shared.tsx, persistence/inspector.ts"
trigger: "the user opens the Inspector perspective"
---
