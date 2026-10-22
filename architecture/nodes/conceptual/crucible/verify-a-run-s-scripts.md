---
id: "17223d22-4d3f-4c54-b707-987d906c86c8"
type: "requirement"
label: "Verify a run's scripts"
action: "the CLI shall serve the run's build on its port, run each script from the run's folder, show the end of what each printed and its exit status, stop the server whatever happened, and keep the results in the round's journal"
ears_type: "event-driven"
rationale: "Every finding is re-run from a fresh page before a person sees it; the agents' guesses were sometimes narrower than the bug."
trigger: "the user runs radical explore verify <run> with the run's reproduction scripts and their arguments"
---
