---
id: "80569cee-16e8-484d-895f-558faa6d353f"
type: "scenario"
label: "Search finds every kind"
given: "a model with views in a folder, a sequence, a presentation with slides and a milestone that share a word"
tests: |
  apps/e2e/tests/studio/search.spec.ts › Quick Search finds views, folders, sequences, slides and milestones, in sections
  apps/e2e/tests/studio/search.spec.ts › a folder pick shows it open in the list of views
then: "the hits are listed in the sections Views, Folders, Elements, Sequences, Presentations and Milestones with their counts; the folder's pick opens the list of views on it, unfolded"
when: "the user types the word in Quick Search, and then picks the folder"
---
