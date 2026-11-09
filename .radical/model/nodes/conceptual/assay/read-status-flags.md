---
id: "7e226f71-e492-44e7-a6b1-186cb5bc7fc8"
type: "requirement"
label: "Read status flags"
action: "the system shall record them as a state fact of flags of that table, its values each flag set and cleared, and the lines of the repository's code that set or clear each; a lifecycle's words name its flags (destroyed, enabled, active, published, accepted, rejected, …), PL/pgSQL's := 't' and := 'f' and 'Y'/'N' set and clear them, and a comment, a Sqitch reworked or revert script sets nothing"
ears_type: "event-driven"
rationale: "Legacy code keeps a lifecycle in flags and dates more often than in a status column."
trigger: "a table has boolean columns named for a condition (is_dead, banned, deleted) or nullable dates named for an event (PaidOn, shipped_at)"
---
