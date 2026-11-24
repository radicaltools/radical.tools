---
id: "047d8115-3091-49c5-8a2a-44954a73b303"
type: "requirement"
label: "Pull-request pipeline in time"
action: "finish all the pipeline runs of a pull-request commit, from the start of the first to the end of the last, within 15 minutes for at least 90 % of the commits of the last 30 days"
ears_type: "ubiquitous"
rationale: "Feedback that people wait for keeps changes small and integrated; a slow pipeline is worked around by batching changes and merging without waiting (Fowler, Continuous Integration: keep the build fast; DORA: continuous integration)."
---
