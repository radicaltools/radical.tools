---
id: "7305b30c-acc2-4074-93a9-85e0d0f86ef2"
type: "requirement"
label: "Browse Hub in Studio"
action: "Studio shall list the Hub's concern packs in a dialog that keeps one size whatever the group, with the concern groups on its side, each with the number of packs that match the search text, show only the packs of the group picked whose name, description or tags contain the search text, and mark the packs already imported in this session and those made for another metamodel."
ears_type: "event-driven"
rationale: "Finding the concern among the packs without the dialog changing size under the pointer; the dialog is the concern wizard's frame, so the wizard opens over it in the same place. Evidence: apps/studio/src/renderer/src/components/HubImportModal.tsx (groupCounts, importedIds, requiredMetamodel), apps/studio/src/renderer/src/studio.css (.nw.hi), packages/ui/src/store/hubStore.ts (filteredConcepts)."
trigger: "the user opens Import from Hub… under Models on the toolbar"
---
