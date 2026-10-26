---
id: "867ea174-a306-4b47-856e-3d478313389e"
type: "scenario"
label: "Tidy around"
given: "a view where one element was just added among others that stand well; and a view with a pinned element and a row elsewhere"
tests: |
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › tidy around moves only the given elements and what they relate to
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › tidy around reaches one step out, not along a chain
  apps/mcp/src/folderModel.test.ts › long Smart Layout runs › tidies around the given elements only
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › tidy around leaves a pinned element and those it has no relation with where they are, with a row elsewhere on the view (F-0106)
then: "the element and what it relates to move (one step out, not what that relates to in turn); every other element stands where it was; a pinned element and the elements the tidied ones have no relation with stay where they are, also with a row elsewhere on the view"
when: "the user tidies around that element"
---
