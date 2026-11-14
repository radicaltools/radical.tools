---
id: "5460d9dd-e1ed-4b41-ac58-d486eccd0f25"
type: "scenario"
label: "Verification on the card everywhere"
given: "a folder model with a need, a requirement derived from it, a scenario bound to a failing test and one bound to a passing test, and a fitness function with a measured metric condition; the test results and measurements beside the model"
then: "the requirement's card shows broken, Checked by with both scenarios and their statuses, the finding that its test failed, and Path; a click on a scenario there moves the card to it; the fitness function's card shows its metric condition with the value, unit, sensor and age; in the Inspector the link of a finding opens the same card, read-only, with Show on canvas and Open wiki page, and the Inspector has no panel of its own"
when: "the user opens the requirement's card in Viewer, then the fitness function's, then follows the failing test's finding in the Inspector"
---
