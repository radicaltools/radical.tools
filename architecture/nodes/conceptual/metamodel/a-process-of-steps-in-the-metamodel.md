---
id: "aae18e38-3e10-4fa8-bc5b-852fc85a3e71"
type: "scenario"
label: "A process of steps in the metamodel"
given: "a model on the Radical metamodel"
tests: "packages/common/tests/warnier.test.ts › process and step types"
then: "every element and relation is valid, the steps default to running once in sequence, and a step outside a process or step, or performed by a requirement, is refused"
when: "a process Checkout is added with steps, one repeated 1..n for each order line, a choice of payment with two steps inside, a step performed by a system, the process satisfying a requirement and verified by a scenario"
---
