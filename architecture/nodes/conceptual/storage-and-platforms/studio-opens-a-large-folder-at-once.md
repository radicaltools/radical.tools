---
id: "5b4757c4-4138-4256-89e2-047b7d499b9a"
type: "requirement"
label: "Studio opens a large folder at once"
action: "Studio shall show the model as the cache has it, list the files' stamps at once and save nothing until it has, and load the folder afresh from its files when any of them differs from the cache, merging into them what the user edited meanwhile."
ears_type: "event-driven"
rationale: "After the cache, listing 21,000 files' stamps was most of what opening a large folder still waited on (about 1.5 s in the browser). Opening as the cache had it, without keeping the cache up with Studio's saves and with the reload that keeps the open canvas's places, showed and then saved old places (ADR Model cache beside the model). Evidence: packages/common/src/formats/mdFolderSync.ts (openFromCache, verified), apps/studio/src/renderer/src/store/documentStore.ts, apps/studio/src/renderer/src/persistence/autosave.ts, apps/studio/src/main/index.ts"
trigger: "the user opens a model folder whose cache is there"
---
