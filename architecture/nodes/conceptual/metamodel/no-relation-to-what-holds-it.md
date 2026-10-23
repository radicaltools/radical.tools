---
id: "ef420138-327a-4721-a59a-b7a617c643be"
type: "requirement"
label: "No relation to what holds it"
action: "Studio and the MCP server shall refuse it with a message saying that the one holds the other, and the canvas shall not mark the element that holds it as a target while connecting; and an element moved into another (nested by the special key, Move to…, the card's Parent, move_node) shall lose its relations with what then holds it, and so shall what it holds, Studio warning which relations went and move_node saying so."
ears_type: "unwanted-behaviour"
rationale: "Containment already says how the two belong together; a relation between them repeats it and draws a line from an element to its own frame. A transition to a state that holds its source is SCXML (it leaves and enters that state again), so it stays allowed. Evidence: packages/common/src/model.ts (relationRefusal); packages/common/src/viewPipeline.ts (connectTypes)"
unwanted_condition: "a new relation, or a relation whose end is moved, would join an element and an element that holds it at any depth (a container and the system it is in), and it is not a transition of a state machine"
---
