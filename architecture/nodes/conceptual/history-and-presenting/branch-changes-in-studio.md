---
id: "d7236a54-3f9b-46d0-b66e-14fbcd069b31"
type: "scenario"
label: "Branch changes in Studio"
given: "a folder model with a .radical/base.json in which one element has another description, one element is missing and one is extra"
metrics: |
  test(apps/e2e/tests/studio/branch-changes.spec.ts › the changes since the base show on the canvas, in the list of views and on the card) passed
  test(apps/e2e/tests/studio/branch-changes.spec.ts › a removed element is drawn inside its container on a view laid out its own way, and a view with a chain counts it) passed
  test(apps/e2e/tests/studio/branch-changes.spec.ts › a base saved since HEAD says so) passed
  test(apps/e2e/tests/studio/branch-changes.spec.ts › a branch that only adds a relation counts it) passed
  test(packages/common/tests/branchChanges.test.ts › branch changes) passed
  test(packages/common/tests/branchChanges.test.ts › base file › says what a base from git is counted since, as it was chosen) passed
  test(packages/common/tests/modelChanges.test.ts › model changes › counts an empty text, an unticked box or an empty list as no value, as a reload of the folder does) passed
  test(packages/layout/tests/geometry.test.ts › placeGhosts) passed
then: "the canvas marks the new, changed and removed elements and the button counts them with the changed relation (4, its tooltip saying 3 elements and 1 relation), the list of views counts the changes each view shows (a removed element too, on a view with a chain), a removed element's ghost lies inside its container clear of its siblings, the card marks the changed description with its removed and added words, the rename counts at once as a change, a box ticked and unticked counts as none, a base saved since HEAD is named so, a branch that only adds a relation counts 1 relation, and turning it off removes every mark"
when: "the user turns on Changes on branch, selects the changed element, renames another and turns it off"
---
