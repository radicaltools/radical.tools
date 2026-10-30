---
id: "e77a62a0-c16e-4333-9303-480d186cf9b7"
type: "scenario"
label: "Outside changes flash"
given: "a folder model open in Studio"
metrics: "test(apps/studio/tests/changeFlash.test.ts › outside changes flash) passed"
then: "added, changed and removed elements are marked, the removed ones as ghosts, and the marks go after the set time from the last change; a change of positions alone marks nothing"
when: "its files change outside the app: elements added, renamed, removed or re-described, only moved, or changed twice in a burst"
---
