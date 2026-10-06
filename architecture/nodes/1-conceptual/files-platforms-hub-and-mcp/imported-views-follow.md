---
id: "558fefc4-e625-43c6-b2cc-ba6d5e939c99"
type: "requirement"
label: "Imported views follow"
action: "Studio shall add the concept's named views to the model, named with the concept as prefix, limited to the imported elements and dropping views that would be empty."
ears_type: "event-driven"
rationale: "Blueprint views (context, containers, flows, wikis) are part of the value of importing. Evidence: packages/ui/src/hub/conceptViews.ts:67-105; apps/studio/src/renderer/src/components/HubImportModal.tsx:575-606; manual#hub"
trigger: "Studio imports a Hub concept that has named views"
---
