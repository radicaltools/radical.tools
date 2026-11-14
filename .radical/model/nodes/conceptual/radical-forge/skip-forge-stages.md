---
id: "e176a386-bc23-4fc2-80f3-5735bac134ce"
type: "requirement"
label: "Skip Forge stages"
action: "the MCP server shall mark each as skipped with the reason, let the later stages run without them, name the next stage to take, and show each with the reason in forge_finish and in the run's status Studio reads; it shall refuse a stage that is open or done, naming it, and run a skipped stage again when the agent clarifies or generates it"
ears_type: "event-driven"
rationale: "A back end needs no mockups and a system without lifecycles no state machines; leaving a stage out should cost one call."
trigger: "an agent calls forge_skip_stage with one or more stages of its Forge run that are not begun, and a reason"
---
