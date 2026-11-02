---
id: "6f8c824a-0216-44ac-96ec-c08ce6d8800a"
type: "requirement"
label: "Playwright sensor"
action: "it shall run Playwright on the spec in the given directory with the given environment and RADICAL_METRICS_DIR set, and measure what the radical-metrics/1 files the spec writes there hold."
ears_type: "event-driven"
rationale: "A browser benchmark measures what its spec knows (opening, switching views, typing); the spec names its metrics, and nothing maps its output. Evidence: apps/cli/src/sensors/playwright.ts, apps/e2e/tests/studio/scale.spec.ts"
trigger: "the playwright sensor runs a spec"
---
