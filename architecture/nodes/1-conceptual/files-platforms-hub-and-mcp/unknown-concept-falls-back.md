---
id: "659989c9-3253-4f6e-8d02-8dc51ee101fc"
type: "requirement"
label: "Unknown concept falls back"
action: "The Hub shall show the catalogue without a diagram."
ears_type: "unwanted-behaviour"
rationale: "Stale or mistyped links must still land somewhere useful. Evidence: apps/hub/src/HubApp.tsx:300-321; apps/hub/src/hubRoute.ts:37-69"
unwanted_condition: "a Hub link names a concept that is not in the catalogue"
---
