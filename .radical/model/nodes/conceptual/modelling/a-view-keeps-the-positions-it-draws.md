---
id: "a4b4648a-c118-48e8-a5f6-7a1e1e5f6fea"
type: "scenario"
label: "A view keeps the positions it draws"
given: "a model with a person, a shop with two containers and a bank, a view of one container and the bank, a table view, a view of every element and a view whose filter chain gives the containers, each holding every element's position; and over MCP, a view of three of four elements"
metrics: |
  test(packages/ui/tests/viewPositions.test.ts › view positions) passed
  test(apps/mcp/src/catalogueTools.test.ts › MCP document tools › lays out one view into its own positions and builds a presentation over it) passed
then: "the view keeps the positions of the container, its shop and the bank, with the bank where it was moved, the table view none, the view of every element all and the view of the chain those of the two containers and their shop; the person gets a place in the view; the agent's layout writes the positions of the three elements only"
when: "the model is opened, the user leaves the view after moving the bank, opens and leaves the table view, and adds the person to the view; and an agent runs smart_layout on the view"
---
