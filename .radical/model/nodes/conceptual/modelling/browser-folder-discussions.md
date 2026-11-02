---
id: "26c42f2c-3f84-4eb1-962d-1d9f312c594f"
type: "scenario"
label: "Browser folder discussions"
given: "a connected Chrome or Edge folder model, same-origin browser tabs, and current desktop discussion writers"
metrics: |
  test(apps/studio/tests/webDiscussions.test.ts › browser discussion storage) passed
  test(apps/studio/tests/discussionWriters.test.ts › browser and desktop discussion writers) passed
  test(apps/e2e/tests/studio/web-discussions.spec.ts › browser folder discussions persist nested replies, attribution and resolution without changing the model) passed
  test(apps/e2e/tests/studio/web-discussions.spec.ts › two browser tabs keep concurrent replies and independently refresh resolved and unreadable files) passed
  test(apps/e2e/tests/studio/web-discussions.spec.ts › a browser write failure keeps the draft, creates no empty discussion file and allows a manual retry) passed
then: "the same panel and discussions.json preserve nesting and attribution across reloads, each node shows only its own threads, all coordinated replies survive, unreadable content is not overwritten, failed writes retain drafts and roll back a new empty file, and model data and watchers remain independent"
when: "the user starts or replies to threads, reopens the folder, resolves a thread, posts concurrently from two tabs or the desktop app, or encounters a write failure, stale thread, invalid file or missing file"
---
