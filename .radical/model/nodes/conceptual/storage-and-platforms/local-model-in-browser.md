---
id: "a590d935-5ebb-42f7-a2ae-4606be15a0f1"
type: "requirement"
label: "Local model in browser"
action: "Studio shall store the new model in the browser's local storage with the chosen metamodel and make it the active model."
ears_type: "event-driven"
rationale: "Lets anyone start modelling with no account and nothing installed. Evidence: apps/studio/src/renderer/src/components/DocumentManager.tsx:88-98; apps/studio/src/renderer/src/store/documentStore.ts:554-568; manual#documents"
trigger: "the user creates a new local model in Manage models and picks a metamodel"
---
