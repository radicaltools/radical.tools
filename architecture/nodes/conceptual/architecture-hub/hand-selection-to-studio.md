---
id: "c8ae3d34-1f27-46ad-86fe-cc5a4a37ff35"
type: "requirement"
label: "Hand selection to Studio"
action: "The Hub shall open Studio in a new tab with the Import from Hub dialog showing the selected concepts."
ears_type: "event-driven"
rationale: "One click from browsing to the user's own model. Evidence: apps/hub/src/HubApp.tsx:407-414,661-667,724-726; apps/hub/src/hubRoute.ts:84-88; apps/studio/src/renderer/src/components/Toolbar.tsx:609-623; manual#hub"
trigger: "the user selects concepts in the Hub and clicks Add to Studio"
---
