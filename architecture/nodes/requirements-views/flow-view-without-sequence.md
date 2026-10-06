---
id: "cbcb6f8e-7c0e-4931-8bd1-f011e0b69703"
type: "requirement"
label: "Flow view without sequence"
action: "The Flow view shall show a hint explaining how to link a sequence or add steps instead of an empty diagram."
ears_type: "unwanted-behaviour"
rationale: "An empty canvas gives no clue what is missing. Evidence: apps/studio/src/renderer/src/components/SequenceView.tsx:202-226; manual#view-flow"
unwanted_condition: "a Flow view has no linked sequence or the linked sequence has no steps"
---
