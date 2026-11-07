---
id: "8b9e3f42-d2de-48ff-9373-e1e6ff51c0a0"
type: "requirement"
label: "Scenario from code with a pending test"
action: "the MCP server shall write the scenario and, where the unit that builds the satisfying element has a test framework, write a pending test of it into that repository and bind it to the scenario in the repository's .radical/radical.json; for a unit with none (VB6), the scenario only"
ears_type: "event-driven"
rationale: "Behaviour no test checks still belongs in the model; a pending test is where the team checks it."
trigger: "the user accepts a requirement whose scenario rests on code the agent quotes rather than on tests or explored paths"
---
