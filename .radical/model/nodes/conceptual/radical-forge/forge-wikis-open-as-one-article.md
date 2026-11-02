---
id: "1131b472-f9c5-490e-a0b3-0f3e5ae97d0b"
type: "requirement"
label: "Forge wikis open as one article"
action: "Radical Forge shall set the view to Multi page with a Depth of 5, the deepest the view allows, so the chain reads as one article down to its last level"
ears_type: "event-driven"
rationale: "A Forge wiki is the document of what the run wrote: needs with their requirements, scenarios and screens, or decisions with those they supersede. In Single page each level is a click away; the user wants it read in one go. Evidence: packages/common/src/ai/forge/views.ts (fileIntoRadicalViews), packages/common/src/ai/modelFacade.ts and apps/studio/src/renderer/src/ai/useDiagramFacade.ts (setWikiPages)"
trigger: "a Forge run with the Radical structure makes a wiki view of a viewpoint (Specification, Decision log)"
---
