---
id: "60fea5d7-4a7f-43bd-a414-84a44901839e"
type: "requirement"
label: "Keep better current layout"
action: "Smart Layout shall leave every position unchanged and tell the user that the current layout already scores best."
ears_type: "unwanted-behaviour"
rationale: "A tool that can only improve the diagram can be pressed without fear. Evidence: packages/layout/src/smartLayout.ts:1270-1287; packages/ui/src/store/diagramStore.ts:2881-2888; packages/layout/tests/smartLayout.test.ts:84-119, packages/layout/tests/smartLayout.test.ts:189-194; manual#layout"
unwanted_condition: "no layout Smart Layout produced scores better than the layout currently on the canvas"
---
