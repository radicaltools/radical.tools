---
id: "6e373c10-1d13-411c-893d-0c6ee252fc11"
type: "requirement"
label: "Measurements from CI"
action: "the CLI shall also read the radical-metrics/1 files in the artifacts it downloads and add their measurements to the model folder's .state/measurements.json, the latest of each metric and labels kept, each with the CI run and commit it comes from in its context; the Inspector's Measurements chip shall say how many of the latest come from CI and from which run"
ears_type: "event-driven"
rationale: "Metrics measured in CI reached Studio only when measured again locally (isostride's question); a CI run keeps its radical sense --out files beside its test reports. Evidence: apps/cli/src/ciResults.ts (downloadCiReports), apps/cli/src/check.ts, components/inspector/Freshness.tsx"
trigger: "radical check runs with --from-ci"
---
