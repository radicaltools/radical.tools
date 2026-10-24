---
id: "a37c201c-ebb6-4e35-b150-ec6acac01186"
type: "scenario"
label: "Pinned elements stay"
given: "a view with two elements pinned where the author dropped them, the rest piled up"
tests: |
  packages/layout/tests/tidy/craft.test.ts › pinned elements stay where they are
  packages/ui/tests/calmDrag.test.ts › Tidy keeps the pins and leaves the pinned elements where they are
then: "the pinned elements have not moved, the rest stands tidied round them, and the pins are still there"
when: "Smart Layout tidies it"
---
