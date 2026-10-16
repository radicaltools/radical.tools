---
id: "7a16cab3-535f-4556-83a1-f4ed81746679"
type: "requirement"
label: "No base or an old base"
action: "Studio shall offer Changes on branch without a count, opening on a click the commands that save a base, or mark the chip and say when and on which branch the base was saved and how to save it again; a file that is no base counts as none"
ears_type: "unwanted-behaviour"
rationale: "Studio cannot tell the branch now checked out; it says what the file says, so an old base is not taken for the branch's changes. Evidence: apps/studio/src/renderer/src/components/BranchChanges.tsx (SaveBaseHelp), packages/common/src/formats/modelBase.ts (parseModelBase, isBaseOld)"
unwanted_condition: "the open model folder holds no base, or one saved more than a day ago"
---
