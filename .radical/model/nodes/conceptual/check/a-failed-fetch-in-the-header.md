---
id: "6a7e1aa4-6624-416d-848f-72c6ab944684"
type: "requirement"
label: "A failed fetch in the header"
action: "the Inspector shall mark its Tests chip and open it to when that fetch ran, what it said, and what CI has to do: keep the test reports as artifacts of the run, named in the repository's .radical/radical.json; test results read with --report shall say · local on the chip as those of CI say · CI"
ears_type: "unwanted-behaviour"
rationale: "Where the results come from was in the chip (From CI, the run, the commit), but not that the last fetch failed, which is why the results were old. What to do names what CI has to keep as artifacts (the model's decision, from isostride's request that the docs say it plainly). Evidence: apps/studio/src/renderer/src/components/inspector/Freshness.tsx, components/inspector/attention.ts, packages/node-files/src/selectionFile.ts (readCheckFiles)"
unwanted_condition: "the last fetch from CI found no results or could not fetch"
---
