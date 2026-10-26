---
id: "27c958de-eecf-49a7-b87f-a056829ad647"
type: "scenario"
label: "Node discussions keep their ancestry"
given: "open threads attached by node ID, optional author emails and nested replies"
tests: "packages/common/tests/discussions.test.ts"
then: "ancestry and attribution snapshots are preserved, independent replies survive, stale actions require review, uncertain IDs are compared without replay, and invalid fields, IDs, timestamps, roots, parents and cycles are rejected"
when: "comments and independent replies are added, threads are resolved and reopened, or an invalid structure or uncertain submission is checked"
---
