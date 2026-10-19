---
id: "172aa7d9-f51f-4609-9870-944b80661756"
type: "scenario"
label: "Refinement asked in Studio"
given: "a Forge run in Studio with a scripted provider whose requirements stage is done"
tests: "apps/e2e/tests/studio/forge.spec.ts › Forge asks before it refines an earlier stage and applies only what the user accepts"
then: "the stage pauses on a card showing what it found, the requirement with its fields and the action's old and new values, while the Domain step shows ✎ in amber; the round's lines, the refused write among them, wrap instead of being cut, and every step stays in sight; after Add it the requirement and the new action are in the model; after Don't add the second requirement is not, the reply reached the AI with the answer, and the step shows ✎2 with a tooltip naming the requirements; no keep-or-reject list follows the stage"
when: "the Domain model stage adds a domain and an entity, proposes a requirement it found missing and a new action for an earlier requirement, which the user adds, then proposes another requirement, which the user declines with a reply"
---
