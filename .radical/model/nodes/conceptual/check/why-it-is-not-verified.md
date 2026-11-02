---
id: "9f10826c-636a-4701-b83d-2e6c5145afcc"
type: "requirement"
label: "Why it is not verified"
action: "the Inspector's Overview shall break the requirements and the accepted ADRs that are not verified down by why: for a requirement no scenario, a test not run, failing; for an ADR no fitness function, a fitness function that names no check, not run (those measured on another event or continually counted apart), failing"
ears_type: "ubiquitous"
rationale: "One number of decisions without a passing check put an ADR nobody wrote a fitness function for beside one whose fitness function runs every night and was never measured here (the user, 2026-10-31: is there a difference between no fitness function and one never run?). Evidence: apps/studio/src/renderer/src/components/inspector/OverviewTab.tsx, attention.ts, packages/common/src/check/evidence.ts"
---
