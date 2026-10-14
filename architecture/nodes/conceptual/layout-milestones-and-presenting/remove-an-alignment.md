---
id: "f164631c-9771-4a25-8750-70b982e460b4"
type: "requirement"
label: "Remove an alignment"
action: "remove that alignment from that canvas and stop drawing its guides"
ears_type: "event-driven"
rationale: "An alignment kept on a canvas must be as easy to drop as to make, or hand-arranging gets stuck. Evidence: apps/e2e/tests/studio/alignment.spec.ts"
trigger: "the user selects a member of an alignment on a canvas and presses Remove row alignment or Remove column alignment on its guide"
---
