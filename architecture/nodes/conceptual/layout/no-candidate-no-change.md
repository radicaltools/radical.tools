---
id: "69b1b75c-083e-486b-8b41-4743788845a6"
type: "requirement"
label: "No candidate, no change"
action: "Smart Layout shall leave every position unchanged and warn the user that no candidate produced a result."
ears_type: "unwanted-behaviour"
rationale: "A failing engine only drops its own candidate (generateCandidate, scoreCandidate catch and log); when none survives, Smart Layout returns the current layout with no candidates and the store shows a warning instead of applying anything. Evidence: packages/layout/src/smartLayout.ts (generateCandidate, unchangedResult), packages/ui/src/store/diagramStore.ts (runSmartLayout: 'Smart layout: no candidate produced a result.')"
unwanted_condition: "every layout engine of Smart Layout fails or returns no positions for the canvas"
---
