---
id: "984c9f46-f8d2-4921-a2c6-5efce41f9371"
type: "requirement"
label: "Flow view draws sequence diagram"
action: "The Flow view shall draw the steps as numbered arrows between participants ordered by first appearance, showing a step's note instead of the relation label when one is set, and a caption with the step and participant counts."
ears_type: "state-driven"
precondition: "a Flow view is linked to a sequence with steps"
rationale: "The sequence diagram is the readable form of a runtime scenario. Evidence: apps/studio/src/renderer/src/components/SequenceView.tsx:58-115, 410-416, 570-578; manual#view-flow"
---
