---
id: "51886165-61b6-4688-afee-a1e1e326c790"
type: "requirement"
label: "Hub preview saves nothing"
action: "The Hub shall let the user move elements, run Smart Layout and switch views without storing any change, and show element properties read-only."
ears_type: "state-driven"
precondition: "a concept is open in the Hub's viewer"
rationale: "The page declares the viewer runtime profile, so the diagram store persists nothing and stays in the explore mode; the Smart Layout button says 'Exploration only — nothing is saved.' Evidence: apps/hub/index.html (__RADICAL_PROFILE), packages/ui/src/runtime.ts, apps/hub/src/HubApp.tsx (SmartLayoutButton readOnlyNote, RightPanel readOnly)"
---
