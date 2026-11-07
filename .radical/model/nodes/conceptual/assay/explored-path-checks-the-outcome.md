---
id: "e113a02b-efc5-44f7-8448-286ca0d42c03"
type: "requirement"
label: "Explored path checks the outcome"
action: "the MCP server shall check the text is on the current screen, record it as a step of the path, and the path's test shall assert it"
ears_type: "event-driven"
rationale: "A test of a path must check what the scenario says happens, not only where the path went."
trigger: "an agent calls assay_explore_act with expect and a text during a path"
---
