---
id: "d27e5fdb-575f-4230-8fc6-5f8dd9c4610e"
type: "scenario"
label: "Another repository's element not measured"
given: "an ADR that constrains element X, which this repository builds, and element Y, which it does not; a second ADR that constrains only Y; each with a fitness function and a sensor; .radical/radical.json names the model"
then: "the first fitness function is measured for X only, and the second is not measured"
when: "radical sense run runs"
---
