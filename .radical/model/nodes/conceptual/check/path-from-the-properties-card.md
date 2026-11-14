---
id: "31dd713e-0b54-407c-b58b-c610569d7759"
type: "scenario"
label: "Path from the properties card"
given: "a folder model with a need, a requirement derived from it and a scenario bound to a failing test, open in Designer; first without test results, then with them"
then: "without test results Path is greyed out and says why; with them it is offered in the requirement's Verification section (and not for a container); a click switches to the Inspector on the requirement's verification path, the requirement marked; Studio's Back returns to Viewer, and the Inspector's own button then opens it on its tabs"
when: "the user opens the requirement's properties card, then clicks Path"
---
