---
id: "7305b30c-acc2-4074-93a9-85e0d0f86ef2"
type: "requirement"
label: "Browse Hub in Studio"
action: "Studio shall list the Hub's concepts with filters by category, tag and search text, mark the concepts already imported in this session and those made for another metamodel, and name the selected element an import would go into."
ears_type: "event-driven"
rationale: "Evidence: apps/studio/src/renderer/src/components/HubImportModal.tsx (CATEGORIES filter bar, activeTags, Search concepts…, importedIds, requiredMetamodel warning, getDropTarget), packages/ui/src/store/hubStore.ts."
trigger: "the user opens Import from Hub… under Models on the activity rail"
---
