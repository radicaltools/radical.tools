---
id: "061e1630-3e5b-4274-9d55-921e990f3dbe"
type: "scenario"
label: "A saved exploration stays one"
given: "an exploration of API in the bookstore model, grown by API's +"
tests: |
  packages/ui/tests/exploreView.test.ts › a saved explore view
  packages/common/tests/exploreView.test.ts
  apps/mcp/src/catalogueTools.test.ts › lists a view of type Explore with its start, keeps it through an edit, and lays out none of it
  apps/e2e/tests/studio/explore.spec.ts › a saved exploration stays an explore view, grown in Designer and only looked at in Viewer
then: "\"API context\" is a view of type Explore drawn as the exploration was, with its + menus and −, and it reads back the same from a .radical file and a Markdown folder; Web App's + adds Customer and is saved, Undo takes it back; after a reload it is drawn the same; in Viewer the + adds elements that are gone again back in Designer and nothing is saved; switched to Structure it keeps its elements and places; over MCP get_model_summary lists it with its start and smart_layout leaves it alone"
when: "the user saves it as \"API context\", clicks Web App's + on the saved view and undoes it, reloads, opens it in Viewer and clicks a + there, goes back to Designer, and switches its view type to Structure"
---
