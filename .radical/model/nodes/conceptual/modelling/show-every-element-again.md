---
id: "86ed19b4-4ff0-4fc3-a24c-612527247841"
type: "requirement"
label: "Show every element again"
action: "Studio shall make the view list no element, so that it shows every element of the model, or start its chain from every element of the view; a level under it may likewise take any element along a relation that reaches several types (Contains → Any element)."
ears_type: "event-driven"
rationale: "A view that lost elements needs one step back to the whole model, and a chain needs a level that is not one type. Evidence: packages/ui/src/components/ViewPipelinePanel.tsx (Show every element), packages/common/src/viewPipeline.ts (suggestStartWays, suggestNextWays, wayLabel), packages/common/tests/viewPipeline.test.ts, apps/e2e/tests/studio/view-pipeline.spec.ts; manual#view-steps"
trigger: "the user clicks Show every element beside This view's elements in the view's Filter, or picks Every element under Start with"
---
