---
id: "5f99c955-5856-4402-83db-a46ed98c46ac"
type: "scenario"
label: "Discussion drafts keep their target"
given: "a reusable discussion panel with node-specific session drafts and an optional remembered email"
then: "the original node receives the submission, other drafts stay intact, attachments follow node IDs with the creation-time label as a missing-target fallback, success follows acknowledgement or a matching ID check, uncertain writes are not replayed, unreadable files and stale replies block posting until recovery or review, and discussions change no model state, undo or layout"
when: "the user switches nodes or folders during a pending post, renames, deletes or restores a node, posting fails or loses its acknowledgement, a thread changes, or the file cannot be refreshed"
---
