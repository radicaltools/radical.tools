---
id: "9e446585-5438-4862-82a1-1397cbf2586d"
type: "requirement"
label: "New views laid out, named"
action: "The MCP server shall arrange each new view per element with Smart Layout, name in its reply only the views it arranged, give for each one larger than a canvas draws the refusal, and advise for such a view upsert_viewpoint with kind \"table\", which it accepts, never update_view, which a view per element refuses"
ears_type: "event-driven"
rationale: "create_view said Smart Layout arranged 2 new views per element when it had refused one, and the refusal advised update_view with kind table, which update_view refuses for a view per element (F-0160, round 211–220). Evidence: apps/mcp/src/folderModel.ts (freshLayoutNote); packages/common/src/ai/tools/layoutTools.ts (noCanvasLayout)"
trigger: "an agent's write makes new views per element (create_view with a viewpoint that draws one element, or a new element a group's viewpoint gives a view)"
---
