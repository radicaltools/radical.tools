---
id: "365c8950-05e9-41c0-84a2-080ff270b33d"
type: "requirement"
label: "Milestones keep the versions"
action: "Studio and the MCP server shall keep in it, as in a slide's own copy of the model, only the model's own elements and relations and the commit of each other model fetched then; when it is shown, Studio shall show the other models' elements as they were at those commits, or, when those versions are not fetched, the model's own and a note naming the command that fetches them"
ears_type: "event-driven"
rationale: "A milestone is the system at a phase: the other models it was drawn against belong to that phase too, and a copy of them in the folder would break the rule that nothing of theirs is written there; their commits are enough to fetch them again. A milestone made before records no versions and shows the other models as fetched now. Evidence: packages/common/src/ai/modelFacade.ts (createMilestone), packages/common/src/federation.ts (otherModelsAt)"
trigger: "a milestone is made of a model whose other models are fetched"
---
