---
id: "ab578e5a-14e7-4dc4-b3e9-8ac632563a9c"
type: "scenario"
label: "Lone element held near"
given: "an element related only to an open web app, far away, already beside it, pinned, or with another element in its way"
tests: "packages/layout/tests/groupHoldPhysics.test.ts › Live layout physics: an element related only to an open group"
then: "the far element is brought back to about 260 px from the web app, which stays as it was; one already beside it stays, a pinned one stays, and one with an element in the way stops before it without pushing it"
when: "the live layout runs until it rests"
---
