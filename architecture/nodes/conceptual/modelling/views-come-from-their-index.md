---
id: "e211578d-28e8-44ff-bb53-9863ba253410"
type: "requirement"
label: "Views come from their index"
action: "Studio shall take the elements of each view whose filter reads nothing but types, parents and relations from .radical/cache/views.json instead of running the filter, and run it for the others."
ears_type: "event-driven"
rationale: "Working out what each view shows was the largest computation left in opening a model of 21,000 elements (about 0.8 s for its 46 views). Evidence: packages/common/src/viewPipeline.ts (viewIndex, presetViewIndex), packages/common/src/formats/modelCache.ts, apps/studio/src/renderer/src/persistence/viewIndex.ts"
trigger: "Studio opens a model whose structure (each element's type and parent, each relation's ends and type) is the one its view index was made for"
---
