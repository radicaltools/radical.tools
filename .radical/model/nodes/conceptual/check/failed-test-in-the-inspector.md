---
id: "43ef22f0-2f82-4ba9-bc4e-cb28aa6e597b"
type: "scenario"
label: "Failed test in the Inspector"
given: "a folder model with a requirement verified by a scenario that names one test, and no check report yet"
then: "the button is greyed out until the report is there; the Overview shows one finding to fix, the failed test by its title with the requirement it leaves unverified; Model and Implementation list no findings, Model being complete and Implementation showing 0 of 1 requirements verified, 1 broken; the link shows the requirement selected on the Specification view in the perspective open, its card saying broken and naming the scenario, and a passing run leaves nothing to fix"
when: "radical check writes a report in which that test failed, the user opens the Inspector, looks at its Model and Implementation tabs and follows the requirement's link"
---
