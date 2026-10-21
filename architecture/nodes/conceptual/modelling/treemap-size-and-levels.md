---
id: "637e5f54-27f5-4e22-bf73-380d9f4f772a"
type: "requirement"
label: "Treemap size and levels"
action: "The hierarchy view shall resize or limit the rectangles accordingly and save the choice with the view, each change as one undo step and a choice of what is already set as none, with two levels as the default, and keep Size, Levels and Up clear of the properties card."
ears_type: "event-driven"
rationale: "Different questions (size, ownership, connectivity) need different area measures and depths. Evidence: apps/studio/src/renderer/src/components/TreemapView.tsx:85-105, 217-225, 496-522; packages/common/src/c4.ts:116-130; manual#view-hierarchy"
trigger: "the user changes Size (leaves, uniform, relations) or Levels (1-4, all) in a Hierarchy view"
---
