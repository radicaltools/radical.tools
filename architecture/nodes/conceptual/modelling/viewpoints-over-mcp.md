---
id: "fefeb90d-8d17-45e6-bb4d-30c0add18265"
type: "requirement"
label: "Viewpoints over MCP"
action: "the MCP server shall make the view one of the named viewpoint (by id or name; null on update_view keeps its view type and chain, of no viewpoint), refusing an unknown viewpoint or one given with a kind or chain; add or change a viewpoint from a view type and a chain checked against the model, or from a view (fromViewId), refusing a name another viewpoint has and the flow type; delete a viewpoint, leaving its views their view type and chain; bring the views of a changed viewpoint in step; and list the viewpoints in get_model_summary's metamodel message."
ears_type: "event-driven"
rationale: "Agents set up views the way Studio does, with the same shared tool catalogue. Evidence: packages/common/src/ai/tools/viewTools.ts (viewpointFor), packages/common/src/ai/tools/metamodelTools.ts (upsert_viewpoint, delete_viewpoint), packages/common/src/ai/modelFacade.ts, packages/common/src/ai/metamodelContext.ts, apps/mcp/README.md"
trigger: "an agent calls create_view or update_view with a viewpoint, or upsert_viewpoint or delete_viewpoint"
---
