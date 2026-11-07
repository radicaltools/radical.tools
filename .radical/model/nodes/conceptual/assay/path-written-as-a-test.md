---
id: "b4c52bdc-3f40-4f7d-843e-5a3672fb8690"
type: "scenario"
label: "Path written as a test"
given: "a recorded path and a requirement proposed with a scenario resting on it"
then: "e2e/assay/<path>.spec.ts in the application's repository replays the path with role-and-name locators and checks each screen, and its .radical/radical.json binds the scenario to that test"
when: "the user accepts it"
---
