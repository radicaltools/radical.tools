---
id: "68a909a2-d320-4b94-8466-780dda875f8f"
type: "scenario"
label: "Card sections fold to their heads"
given: "a model folder with a scenario on the Specification view whose test failed"
then: "the card opens with Verification, Tests and Views folded, their heads saying failed with one finding that fails the check, one test that failed, and one view; a click opens Verification to its finding and Space opens Views to the view; the requirement's card has Verification and Views open and Tests folded, and so has the card after the reload"
when: "the user opens its card, opens Verification and Views, selects the requirement it verifies, and reloads"
---
