---
id: "9fb646d2-b550-45f2-b4b7-1b6dbb688919"
type: "adr"
label: "Agent tools never load a milestone"
alternatives: "A restore_milestone tool (one call replaces the live model; a known way to lose work, see the milestone link bug fixed in #118). Tools that edit a milestone's content with propagate or insert (the Studio workflow needs the user to decide per edit). Milestones only in get_model_summary (Studio's chat has no summary, and creating them needs a tool anyway)."
consequences: "An agent can build phase by phase (build, save, change, save) and describe the differences without touching current work. It cannot look inside a milestone beyond compare_milestones, nor fix an old milestone; both stay in Studio's timeline (open items in docs/IMPROVEMENTS.md). Over MCP list and compare are read-only and write nothing."
context: "Milestones are named copies of the model at phases of the system (as-is, target). Agents had no tools for them: they could not record a phase, see what changed between phases or show a phase on a slide. Studio can also load a milestone over the live model (time travel, Restore to live) and edit it, propagating the edit to later milestones."
date: "2026-10-08"
decision: "The shared AI tool catalogue gets a 'milestone' group: list_milestones, create_milestone (saves the current model as the latest milestone), update_milestone (rename), delete_milestone and compare_milestones (elements and relations added, removed and changed, layout left out), and slides take a milestone. No tool loads, restores or edits a milestone's content. Radical Forge leaves the group out, like presentations and the metamodel."
status: "accepted"
---
