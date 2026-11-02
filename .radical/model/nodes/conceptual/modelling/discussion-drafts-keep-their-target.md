---
id: "5f99c955-5856-4402-83db-a46ed98c46ac"
type: "scenario"
label: "Discussion drafts keep their target"
given: "a reusable discussion panel with node-specific session drafts and an optional remembered email"
metrics: |
  test(apps/studio/tests/discussions.test.ts) passed
  test(apps/e2e/tests/studio/discussions.spec.ts › desktop discussions preserve nested replies, email snapshots and resolution on reopening) passed
  test(apps/e2e/tests/studio/discussions.spec.ts › the pinned panel and per-node drafts survive switching targets during a pending post) passed
  test(apps/e2e/tests/studio/discussions.spec.ts › external refresh, stale replies and write failures keep drafts and leave model files untouched) passed
  test(apps/e2e/tests/studio/discussions.spec.ts › unsafe Markdown stays inert and the composer and ancestry work with the keyboard) passed
then: "the original node receives the submission, other drafts stay intact, attachments follow node IDs with the creation-time label as a missing-target fallback, success follows acknowledgement or a matching ID check, uncertain writes are not replayed, unreadable files and stale replies block posting until recovery or review, and discussions change no model state, undo or layout"
when: "the user switches nodes or folders during a pending post, renames, deletes or restores a node, posting fails or loses its acknowledgement, a thread changes, or the file cannot be refreshed"
---
