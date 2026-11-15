---
id: "17223d22-4d3f-4c54-b707-987d906c86c8"
type: "requirement"
label: "Verify a run's scripts"
action: "the CLI shall serve the run's build with each server .radical/crucible/crucible.json lists (Studio and the Hub in this repository), each on its port of the run, run each script from the run's folder (run-NN in its round's folder), show the end of what each printed and its exit status, judge whether it shows the bug by the lines it prints (a BUG or FINDING line, or REPRODUCED: yes, says it shows; only REPRODUCED: no says it does not) and else by its exit (1 while the bug shows, 0 when it does not), say when the line and the exit disagree, stop the servers whatever happened, and keep the results, each script with whether it shows the bug, in the round's journal and list the scripts that show it; a script not in the run's folder shall stop verify with exit 2 before anything runs, recording nothing"
ears_type: "event-driven"
rationale: "Every finding is re-run from a fresh page before a person sees it; the agents' guesses were sometimes narrower than the bug. It served Studio alone, so a run's scripts that tested the Hub failed (round 170–175, IMPROVEMENTS 44). A script's exit status alone said little: scripts exited 0 while printing that the bug showed. A BUG line was read as the bug not showing (F-0146), and a script missing from the run's folder was recorded as not showing it (F-0147, round 211–220)."
trigger: "the user runs radical explore verify <run> with the run's reproduction scripts and their arguments"
---
