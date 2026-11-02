---
id: "3d1093f5-a40f-4855-ae52-b61dc5799005"
type: "adr"
label: "Tech Radar derived from ADRs"
alternatives: |
  1. A technology node type with ring and quadrant, used by components and constrained by ADRs: one point per technology however many components use it, but a second record of what the ADRs say (not wanted for now, 2026-10-29).
  2. Ring and quadrant as required ADR properties: every ADR already in a model would need editing before the radar shows anything.
consequences: |
  • No new type to learn or keep; the radar is as current as the decisions.
  • One ADR is one point: an ADR that picks two technologies shows once, under its technology name.
  • Trial has to be set by hand; the four ADR statuses cannot tell it from Assess.
  • A radar across an organisation's models waits for federation.
context: "The Tech Radar group holds the packs that choose technologies. A tech radar places each technology in a ring (Adopt, Trial, Assess, Hold) and a quadrant (Techniques, Tools, Platforms, Languages & Frameworks). A model already records in its ADRs which technology was chosen and why; a separate kind of element for technologies would say it a second time and need its own upkeep."
date: "2026-10-29"
decision: "The radar is drawn from ADRs, with no new node type. An ADR is on the radar when its concern is a pack of the Tech Radar group, or when it chooses a named tool in another pack (a broker in Messaging, a linter in Code quality gate). Its ring comes from its status (accepted: Adopt; proposed: Assess; deprecated: Hold; superseded: off the radar, its successor is on it), its quadrant from its pack (backend and frontend stack: Languages & Frameworks; data store and infrastructure: Platforms; SDLC Standard and Coding Standards: Tools; Architecture: Techniques), and its name from its label. Three optional ADR properties override what cannot be derived: radar ring (to tell Trial from Assess), radar quadrant, and technology (the short name on the radar). Left empty, the derived values hold, so the ADRs already in a model are on the radar without edits."
status: "proposed"
---
