---
id: "93b0da16-1371-41c0-bb12-a246b5efce56"
type: "requirement"
label: "Harden a finding"
action: "the CLI shall mark the finding hardened, keep in it the test that replays its steps (<fuzz file> › <id> stays fixed: <title>) and the scenario, print the test() line to add to the scenario's Metrics, and leave the model's files as they are"
ears_type: "event-driven"
rationale: "A finding ends as a test bound to the model; the agent or the person adds the binding through the model's tools, as for any test."
trigger: "the user runs radical harden <finding id> for a fuzz finding, with --scenario naming the scenario its test proves"
---
