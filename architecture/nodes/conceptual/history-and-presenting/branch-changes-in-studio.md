---
id: "d7236a54-3f9b-46d0-b66e-14fbcd069b31"
type: "scenario"
label: "Branch changes in Studio"
given: "a folder model with a .radical/base.json in which one element has another description, one element is missing and one is extra"
tests: |
  apps/e2e/tests/studio/branch-changes.spec.ts › the changes since the base show on the canvas, in the list of views and on the card
  packages/common/tests/branchChanges.test.ts › branch changes
then: "the canvas marks the new, changed and removed elements and the button counts them, the list of views counts the changes each view shows, the card marks the changed description with its removed and added words, the rename counts at once as a change, and turning it off removes every mark"
when: "the user turns on Changes on branch, selects the changed element, renames another and turns it off"
---
