---
id: "582cb3a5-d5d5-4267-943f-5b28823d62e6"
type: "requirement"
label: "Fuzz the model's rules"
action: "the system shall run random sequences of the project's actions through a driver (in-process, UI or MCP, one or several actors at once), check after every step the generic invariants of a stateful application and the rules the model states (EARS requirements, state machine transitions, domain invariants, ADR decisions), shrink each failure to its shortest sequence, group failures by signature and report each with its seed, sequence and what differs, leaving out those listed as known"
ears_type: "event-driven"
rationale: "In exploratory runs 45 to 69 about half of the findings were a rule already fixed once, broken in another place or by the fix next to it; a test of the scenario reported cannot see them, a rule checked over random sequences can."
trigger: "the user runs radical fuzz on a project"
---
