---
id: "5fdc52be-be95-4902-a27c-c5f78db8acc6"
type: "requirement"
label: "No report, no Inspector"
action: "grey out the Inspector button and say in its tooltip how to make a report"
ears_type: "unwanted-behaviour"
rationale: "Requested by the product owner. A base alone opens it too, since This change lists the branch's changes there (2026-10-16). Evidence: InspectorModeButton in apps/studio/src/renderer/src/components/Toolbar.tsx"
unwanted_condition: "the open model has neither a check report nor a base beside it"
---
