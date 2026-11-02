---
id: "60fea5d7-4a7f-43bd-a414-84a44901839e"
type: "requirement"
label: "Keep better current layout"
action: "Smart Layout shall leave every position unchanged and tell the user that the current layout already scores best."
ears_type: "unwanted-behaviour"
rationale: "A tool that can only improve the diagram can be pressed without fear. A layout that lost about as much as it gained replaced the one on screen (exploratory runs 65 to 69, 2026-10-21); since then the other must gain at least twice what it loses, criteria standardised. Evidence: packages/layout/src/smartLayout.ts:1270-1287; packages/layout/src/ranking.ts (bestIndexKeepingCurrent, KEEP_CURRENT_RATIO, standardised); packages/ui/src/store/diagramStore.ts:2881-2888; packages/layout/tests/smartLayout.test.ts:84-119, packages/layout/tests/smartLayout.test.ts:189-194; packages/layout/tests/ranking.test.ts; manual#layout"
unwanted_condition: "no layout Smart Layout produced is clearly better than the layout currently on the canvas: ahead of it overall, and gaining at least twice what it gives up, criterion by criterion"
---
