---
id: "28d746a3-aee3-4622-a682-40bc3a340b98"
type: "requirement"
label: "Few runs need a rerun"
action: "need a second attempt for at most 5 % of its completed runs over the last 30 days"
ears_type: "ubiquitous"
rationale: "A run that passes on a second attempt teaches everyone to press Re-run, and then real failures are rerun too; the rerun rate shows the pipeline's own flakiness, while flaky tests are handled as the Test strategy pack decides (Fowler, Eradicating Non-Determinism in Tests)."
---
