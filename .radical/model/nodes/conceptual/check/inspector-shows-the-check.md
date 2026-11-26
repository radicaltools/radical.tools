---
id: "8a276a1a-bb87-49ae-9325-34bddce6a6a7"
type: "requirement"
label: "Inspector shows the check"
action: "show what radical check says about the live model as it is now, also while Designer or Viewer shows a milestone, which stays shown, opening on an Overview tab (what is to fix; then a row of scores: consistency, completeness, traceability and decisions, each as strong as its weakest metric, and requirements verified, decisions verified and named tests passing, each with its goal), a Model tab (the chain from needs to tests, gaps by group, goals and baselines), an Implementation tab (what the last check report says: what falls out at each step, coverage by architecture element, the checks that do not pass and what they leave unverified), a Measurements tab, a Debt tab (what the check finds that does not fail it) and a This branch tab, and make every element it names a link that shows it in the perspective open, on the view Quick Search would pick, selected with its properties card"
ears_type: "event-driven"
rationale: "The report becomes something a person reads and acts on, not a CI log: how good the model is, and how faithfully the implementation follows it. The Overview puts what to do first; the user found the tabs hard to read, with what needed fixing under tiles and funnels (2026-10-31), and then under the score tiles and among the warnings (2026-11-26). Evidence: apps/studio/src/renderer/src/components/Inspector.tsx, components/inspector/OverviewTab.tsx, ModelTab.tsx, ImplementationTab.tsx, DebtTab.tsx, ThisChange.tsx, shared.tsx, persistence/inspector.ts"
trigger: "the user opens the Inspector"
---
