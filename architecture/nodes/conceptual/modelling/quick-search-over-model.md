---
id: "0e180cb1-5bac-46de-814f-7884ee6caf4f"
type: "requirement"
label: "Quick Search over model"
action: "Studio shall focus Quick Search, which searches the whole model: elements, relations, views and their folders, sequences, presentations with their slides, and milestones."
ears_type: "event-driven"
rationale: "Finding an element by name is faster than scanning a large diagram. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx; packages/common/src/search.ts; manual#workspace; manual#shortcuts"
trigger: "the user presses ⌘/Ctrl+P outside a running presentation"
---
