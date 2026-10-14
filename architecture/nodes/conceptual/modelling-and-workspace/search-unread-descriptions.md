---
id: "9768f8de-c0bc-4b4a-8599-a97c1a96c41d"
type: "requirement"
label: "Search unread descriptions"
action: "Quick Search and the Nodes filter shall offer to search the descriptions not read yet, and Studio shall read an element's description from its file when the element is selected or its wizard opens."
ears_type: "state-driven"
precondition: "a folder model is open whose element descriptions have not all been read into memory"
rationale: "A folder model loads its element descriptions on demand, so an instant search cannot see them. Evidence: apps/studio/src/renderer/src/store/documentStore.ts (deserializeFromMdFolder lazy, hydrateNodeBody), packages/ui/src/store/diagramStore.ts (pendingBodyNodeIds, hydrateNode, scanDescriptions), apps/studio/src/renderer/src/components/QuickSearch.tsx, packages/ui/src/components/RightPanel.tsx."
---
