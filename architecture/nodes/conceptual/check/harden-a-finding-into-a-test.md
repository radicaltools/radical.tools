---
id: "69914700-ef4d-44db-9037-48def6758e1f"
type: "requirement"
label: "Harden a finding into a test"
action: "the system shall write a deterministic unit or e2e test in the project's style that reproduces it, confirm the test fails on the current code for the finding's reason, run it repeatedly in parallel and under load to reject a flaky test, and bind it to the scenario in the model that the finding breaks, so that radical check counts it"
ears_type: "event-driven"
rationale: "A finding is worth keeping only as a test that fails first and does not flake; this round's flakes (a leaked timer, a camera leaving the dragged element off the canvas, a file read during a save) show what a check for flakiness has to catch."
trigger: "the user runs radical harden on a finding (a shrunk sequence or an exploration script)"
---
