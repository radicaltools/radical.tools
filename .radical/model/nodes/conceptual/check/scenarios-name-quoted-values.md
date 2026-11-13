---
id: "b97a603c-3e42-4499-b8a5-e20ec741d842"
type: "requirement"
label: "Scenarios name quoted values"
action: "it shall report a warning on the requirement naming the values and the scenarios"
ears_type: "event-driven"
rationale: "What the person said has reached a check only when a scenario names it. Every value of a requirement, quoted or not, was tried first: 236 findings in the Hub's packs and 103 in radical.tools' model, mostly incidental numbers; the values taken from the person's words gave 2 on the benchmark's model, both cases no scenario covered."
trigger: "radical check or the Inspector checks a requirement with scenarios that states a hard value its quote holds, which none of the scenarios that verify it name in their given, when, then or Gherkin text"
---
