---
id: "9bfb5bd5-0e1c-42cc-9e39-62b60c12a91d"
type: "requirement"
label: "Hand zoom beats fit"
action: "stop that animation, keep the zoom the user picked, and leave Smart Fit switched on"
ears_type: "unwanted-behaviour"
rationale: "A fit still easing the camera took back the zoom the user had just picked. Evidence: apps/e2e/tests/studio/physics.spec.ts"
unwanted_condition: "the user zooms with the mouse wheel while a Fit All or Smart Fit camera animation is still running"
---
