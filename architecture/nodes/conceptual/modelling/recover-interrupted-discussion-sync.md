---
id: "1c0c7414-2092-4c70-a233-51bd95a280cc"
type: "scenario"
label: "Recover interrupted discussion sync"
given: "durably staged imports or outbound comments and coordinated local discussion writers"
metrics: |
  test(apps/cli/src/discussionSync.test.ts) passed
  test(apps/studio/tests/webDiscussions.test.ts) passed
then: "imports retain stable UUIDs and concurrent posts, acknowledged remote IDs are checkpointed before verification, uncertain creates require verified binding or explicit retry, and resolved-thread imports keep resolution and need review"
when: "a write is interrupted, a create acknowledgement is uncertain, a second local writer posts, or a remote reply arrives in a resolved thread"
---
