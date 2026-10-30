---
id: "88679abf-e9c2-4735-aeaf-81889cfc7e4e"
type: "requirement"
label: "Nightly measurements become findings"
action: "the nightly workflow shall write a finding for it in crucible/findings/ (source sense, open), naming the condition, what was measured, the commit and the run, unless an open finding already says the same, and propose the new findings in a bot pull request."
ears_type: "event-driven"
rationale: "The agreed SDLC: the pull-request gate stays deterministic, the sensors that vary run at night, and what the night finds goes to crucible/findings through a bot pull request, not into the model or Studio (ADR Studio's speed is measured nightly). Evidence: tools/nightly-findings.ts, .github/workflows/nightly.yml, packages/crucible/src/findings.ts"
trigger: "the nightly run's measurements break a metric condition of a fitness function triggered on nightly, or measure nothing for one"
---
