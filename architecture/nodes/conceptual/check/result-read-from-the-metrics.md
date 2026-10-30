---
id: "0ddcabd7-d75c-42ed-a108-aa9fbc4a0ecf"
type: "requirement"
label: "Result read from the metrics"
action: "the system shall read a fitness function's result as static when its metric conditions are fixed limits and as dynamic when one is against a baseline, and show it in the function's summary and in the wiki."
ears_type: "ubiquitous"
rationale: "Static or dynamic is how the conditions are written: stated beside them it would be a second source of truth. Evidence: packages/common/src/check/metrics.ts (fitnessResult), packages/common/src/nodeSummary.ts (the result token), packages/common/src/wikiDocument.ts (derivedFacts), packages/ui/src/components/WikiView.tsx, apps/cli/src/wikiExport.ts"
---
