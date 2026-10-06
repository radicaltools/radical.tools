---
id: "0e180cb1-5bac-46de-814f-7884ee6caf4f"
type: "requirement"
label: "Quick Search over model"
action: "Studio shall focus Quick Search, which matches element labels, descriptions, types and technologies, relation labels and view names across the whole model."
ears_type: "event-driven"
rationale: "Finding an element by name is faster than scanning a large diagram. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx:153-175,259-345; manual#workspace; manual#shortcuts"
trigger: "the user presses ⌘/Ctrl+P outside a running presentation"
---
