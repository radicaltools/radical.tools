---
id: "8d8c5d2b-8bb8-48e3-b8dd-414dadd986c0"
type: "requirement"
label: "Known failures pass"
action: "the system shall end that run without failing, or go on past it where the entry says so, count the hit per entry, and list at the end every entry and how often it was hit, the entries no run hit included"
ears_type: "state-driven"
precondition: "a fuzz run breaks a rule in a way a known entry of its fuzz file describes (by the rule, the last action, earlier actions, the paths of what differs, the facts the rule reports, or its own matcher)"
rationale: "CI stays green while a bug is open, and an entry its fix made needless shows up instead of hiding the next failure."
---
