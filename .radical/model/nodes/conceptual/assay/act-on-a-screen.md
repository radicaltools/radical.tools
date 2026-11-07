---
id: "5546d0e1-221a-4e6a-8b70-e2ac12441100"
type: "requirement"
label: "Act on a screen"
action: "the MCP server shall perform it, record it as the next step of the path with the control's role and name and the value typed (a password not: it is cut out of every address recorded too), and return the screen it leads to, its screenshot kept; an action that changes nothing a user sees leaves the screen as it was"
ears_type: "event-driven"
rationale: "A path is what a user does, step by step; recorded by the server, it can be replayed as a test."
trigger: "an agent calls assay_explore_act with a control's reference and an action (click, fill, select, check, press), or an address of the same application"
---
