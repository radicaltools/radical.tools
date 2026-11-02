---
id: "014ee13f-c35a-455a-b222-9f9f2f91138f"
type: "scenario"
label: "A standard judged on each container"
given: "those measurements, Payments API passing and Refunds API failing"
metrics: |
  test(packages/common/tests/fitnessPerElement.test.ts › fitness functions per element › evaluates a fitness function for each element its decision constrains) passed
  test(packages/common/tests/fitnessPerElement.test.ts › fitness functions per element › judges a fetched standard on the model's own elements) passed
then: "metric-failed names Refunds API and the fitness function (on the container, naming the fitness function's model, when the fitness function is fetched); the evidence lists the fitness function with each container and its outcome, failed as a whole, and its ADR broken; a container with no measurement leaves it not run; measured without elements it is judged once, as before; a fetched fitness function not measured here is not this model's evidence"
when: "radical check runs in payments' repository"
---
