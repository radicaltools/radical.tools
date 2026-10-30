---
id: "c64bf701-cd48-45c4-a7f9-4988d10610f1"
type: "requirement"
label: "Views of a large model switch fast"
action: "Studio shall show the view within one second."
ears_type: "event-driven"
rationale: "On a model of 21,000 elements opening any view took 3.5 s, even one of 280 elements: the view's chain ran over the store's drafts inside the state update, and which containers show collapsed was worked out with a scan of the whole model for each container (2026-10-30). Evidence: packages/ui/src/store/diagramStore.ts (setActiveView, _sync), packages/common/src/viewPipeline.ts (viewShownNodes), packages/layout/src/viewInput.ts (computeViewCollapsedSet)"
trigger: "the user opens another view of a model of 20,000 elements"
---
