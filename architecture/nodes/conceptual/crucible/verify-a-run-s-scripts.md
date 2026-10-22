---
id: "17223d22-4d3f-4c54-b707-987d906c86c8"
type: "requirement"
label: "Verify a run's scripts"
action: "the CLI shall serve the run's build with each server crucible.json lists (Studio and the Hub in this repository), each on its port of the run, run each script from the run's folder, show the end of what each printed and its exit status, stop the servers whatever happened, and keep the results in the round's journal"
ears_type: "event-driven"
rationale: "Every finding is re-run from a fresh page before a person sees it; the agents' guesses were sometimes narrower than the bug. It served Studio alone, so a run's scripts that tested the Hub failed (round 170–175, IMPROVEMENTS 44)."
trigger: "the user runs radical explore verify <run> with the run's reproduction scripts and their arguments"
---
