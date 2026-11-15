---
id: "e0d32b4d-46f1-422a-9667-9460bfdbff75"
type: "scenario"
label: "A Hub link waits for a model"
given: "Studio opened from a Hub link of a concern pack, with no model open"
then: "the Welcome screen names the pack that waits and no dialog opens under it; after a reload it still names the pack; once the model is open, the import opens over it, and a reload after that asks nothing"
when: "the user picks a model on the Welcome screen; or reloads the Welcome screen first, and reloads again once the import has opened"
---
