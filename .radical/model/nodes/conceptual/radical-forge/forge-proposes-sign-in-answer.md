---
id: "3dcb3ced-03f4-4f1f-b456-fd85218bc33e"
type: "scenario"
label: "Forge proposes sign-in answer"
given: "the Hub's concern packs and a description of a shop whose customers sign in with Google"
metrics: |
  test(packages/common/tests/forgeConcerns.test.ts › concern packs in Forge › answers the description settles come back proposed, with their words, and an answer that is no option is dropped) passed
  test(packages/common/tests/forgeConcerns.test.ts › concern packs in Forge › the clarify prompt lists the packs' questions and asks for answers the description settles) passed
  test(apps/e2e/tests/studio/forge.spec.ts › Forge proposes a concern pack's answers from the description and imports them once accepted) passed
then: "the sign-in question comes back answered with that option and the description's words, apart from the open questions; the invalid answer is dropped and its question asked; Confirm answers waits until the user accepts the answers, and the imported decision follows the accepted answer; over MCP the clarify prompt tells the agent to show its answers for the user to accept and to ask only the rest"
when: "the model's clarify reply picks the Authentication pack and answers its sign-in question from the description, with one answer that is not an option; in Studio the user sees the form, then accepts"
---
