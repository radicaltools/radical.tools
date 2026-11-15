---
id: "43ef22f0-2f82-4ba9-bc4e-cb28aa6e597b"
type: "scenario"
label: "Failed test in the Inspector"
given: "a folder model with a requirement verified by a scenario that names one test, and no check report yet"
then: "the button is greyed out until the report is there; Model shows no error, the model being complete; Implementation shows one error, the requirement it leaves unverified and 0 of 1 requirements verified, 1 broken; the link shows the requirement selected on the Specification view in the perspective open, its card saying broken and naming the scenario, and a passing run clears the error"
when: "radical check writes a report in which that test failed, the user opens the Inspector, goes to its Implementation tab and follows the requirement's link"
---
