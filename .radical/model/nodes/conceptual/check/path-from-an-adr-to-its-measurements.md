---
id: "9c2382c1-20b5-414e-9e3f-2c062d29c048"
type: "scenario"
label: "Path from an ADR to its measurements"
given: "an accepted ADR that constrains two containers; a fitness function implementing it with a test and a metric condition measured for each container, holding for one and not for the other; a second fitness function implementing it that names no check; a requirement derived from another requirement"
then: "the first path starts at the ADR and goes to both fitness functions; the measured one shows its test and, under each container, the metric condition with its value, unit, source and age, the failing container first; the other shows that it names no check; the second path goes need, requirement, derived requirement, its scenarios"
when: "the verification path of the first fitness function, then of the derived requirement, is asked for"
---
