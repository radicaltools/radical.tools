---
id: "80569cee-16e8-484d-895f-558faa6d353f"
type: "scenario"
label: "Search finds every kind"
given: "the bookstore with its views in the folders Order area and Order area/Inside, the sequence Place Order, a slide Order flow and a milestone Order rework"
metrics: |
  test(apps/e2e/tests/studio/search.spec.ts › Quick Search finds views, folders, sequences, slides and milestones, in sections) passed
  test(apps/e2e/tests/studio/search.spec.ts › a folder pick shows it open in the list of views) passed
then: "the sections Views (3, found by name or folder), Folders, Elements, Sequences, Slides and Milestones list them with the matched part marked; the sequence opens its flow view, the milestone is shown, and the folder opens in the list of views, unfolded and marked"
when: "the user types order in Quick Search and picks the sequence, then m: rework, and later f: inside with Order area folded"
---
