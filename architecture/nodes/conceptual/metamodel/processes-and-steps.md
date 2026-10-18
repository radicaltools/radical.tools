---
id: "1188ff65-fa36-43a6-be01-b01fcc8481f0"
type: "requirement"
label: "Processes and steps"
action: "The Radical metamodel shall have a process type, at the root or in a system, domain or group, and a step type inside a process or a step, a step with how often it runs (1, 0..1, 1..n or 0..n), the condition it runs for and its order among its siblings, and a process or step with how its children run (in sequence, one of them, or at once)"
ears_type: "ubiquitous"
rationale: "Process logic is a procedure of nested steps that repeat, are optional or are alternatives: what a Warnier–Orr diagram draws. The Markdown folder keeps no order among siblings, so a step carries its own. Evidence: packages/common/src/metamodel/presets/governance.ts (process, step), packages/common/src/metamodel/categories.ts (Process)"
---
