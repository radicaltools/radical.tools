---
id: "1bc446a4-cd6e-469f-87d5-818b9758f268"
type: "scenario"
label: "Agent placement and layout"
given: "an MCP server bound to a model folder"
then: "the children sit inside the domain, the domain grows to wrap them and the All elements positions match the node geometry after the layout; the moved node lies inside its new parent on every view that keeps a place for it; smart_layout, align_nodes and grid_nodes refuse a flow view and write nothing"
when: "the agent adds two systems inside a domain, moves a third into it and then calls smart_layout; and calls smart_layout on a flow view"
---
