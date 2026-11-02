---
id: "6bac0ed5-1098-4e98-9d65-5d29819c56e5"
type: "requirement"
label: "Gate leaves out other triggers"
action: "it shall not report the condition as not measured."
ears_type: "event-driven"
rationale: "The pull-request gate measures what runs on pull requests; a nightly function's conditions not measured there are not a gap. Evidence: packages/common/src/check/rules.ts, apps/cli/src/check.ts (--trigger)"
trigger: "radical check runs with --trigger <event> and a metric condition of a fitness function that runs on another event, or continually, has no measurement"
---
