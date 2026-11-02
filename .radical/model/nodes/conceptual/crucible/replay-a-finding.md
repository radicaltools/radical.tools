---
id: "7a906485-5df7-4650-a695-fb3bca2dd075"
type: "requirement"
label: "Replay a finding"
action: "the CLI shall run the finding's fuzz file and world with its seed, path and length, without shrinking, and show the steps as resolved and the rule broken, or that the run passed"
ears_type: "event-driven"
rationale: "A finding is checked again, after a fix or on another commit, with one command."
trigger: "the user runs radical fuzz --replay <finding id>"
---
