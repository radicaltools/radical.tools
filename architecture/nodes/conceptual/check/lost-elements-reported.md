---
id: "e5eed193-91f4-4c67-8fc7-2ea206fb5f02"
type: "scenario"
label: "Lost elements reported"
given: "a model folder with a node file without a type, a copy of another node file, a README, and views, sequences and slides that point at what the model lacks"
metrics: |
  test(packages/common/tests/check.test.ts › radical check › lists stale references in views, sequences and slides) passed
  test(packages/common/tests/check.test.ts › radical check › lists a slide focus on an element the model it shows does not have) passed
  test(packages/common/tests/check.test.ts › radical check: the folder › finds a node file without id or type and a duplicated id, but not a README) passed
  test(packages/common/tests/check.test.ts › radical check › takes a slide of a view its milestone has alone as a view the model has) passed
then: "it reports the file that is not a node and the duplicated id with their paths, leaves the README alone, and lists each stale reference of the view, sequence and slide, a slide's focus on an element the model it shows lacks among them; a slide of a view its milestone has alone is no stale reference"
when: "radical check runs on it"
---
