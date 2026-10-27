---
id: "d5b83873-a42a-4d69-bb33-0108f9a021f6"
type: "requirement"
label: "Setup asks or takes options"
action: "the CLI shall ask nothing and take each answer from its options or its default (the folder architecture, the radical metamodel, the agents it finds installed, the hooks in a git repository), and with --dry-run print every change it would make and write nothing"
ears_type: "state-driven"
precondition: "the standard input is not a terminal, or --yes is given"
rationale: "The same command runs from a README line, a CI job or a dotfiles script, and someone unsure sees the changes first. In a terminal it asks each question with that default, so pressing Enter through it gives the same result."
---
