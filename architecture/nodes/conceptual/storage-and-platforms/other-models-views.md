---
id: "a08a857e-3478-45eb-ad23-408b52a37169"
type: "requirement"
label: "Other models' views"
action: "Studio and the MCP server shall list them in a view folder named after that model, with the folders they have there under it, each drawn as that model draws it and with only that model's elements and those of the models it depends on, and shall refuse every change to them, saying which model they belong to and that a copy can be changed"
ears_type: "event-driven"
rationale: "A team reads another team's architecture as that team drew it, without leaving its own model. A folder per model keeps two views of one name apart (orders › Containers, billing › Containers). A view whose filter decides what it shows would otherwise also show the model's own elements; scoped to its model and that model's dependencies, it shows what it shows in its own repository. Changing it belongs in its repository; a change here would be lost at the next fetch. Evidence: packages/common/src/federation.ts (withOtherModels: views with their origin and scope, in a folder of their model), packages/common/src/viewPipeline.ts (viewShownNodes scoped), packages/common/src/model.ts (viewRefusal)"
trigger: "a fetched model has views"
---
