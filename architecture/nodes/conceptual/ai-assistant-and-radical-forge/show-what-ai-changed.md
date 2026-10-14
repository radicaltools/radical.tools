---
id: "38afc8c6-c711-4fb2-9ce0-adf78443bd13"
type: "requirement"
label: "Show what AI changed"
action: "Quick Search shall show the assistant's answer, a one-line count of added, updated and deleted nodes, relations and views, any tool errors still failing in the last round, and the tokens the run used."
ears_type: "event-driven"
rationale: "Users review what the AI did and what it cost before trusting it. Evidence: apps/studio/src/renderer/src/components/AIReportLine.tsx:7-28; apps/studio/src/renderer/src/components/QuickSearch.tsx:128-129,598-630; apps/studio/src/renderer/src/ai/runner.ts:248-251"
trigger: "an AI chat run finishes"
---
