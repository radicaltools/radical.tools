---
id: "919bde4a-90bf-4ec6-8cc6-9a614359ce2e"
type: "adr"
label: "Edited presets fork"
alternatives: "Store presets in full in every model: edits survive, but models never get new types."
consequences: "An edited metamodel keeps the edit but stops receiving preset updates. Unedited models get new types automatically."
context: "Built-in metamodel presets are swapped for the current preset on load, so models pick up new types such as need."
decision: "Editing a built-in metamodel, in Studio's metamodel editor or through tools, first copies it under a custom id."
status: "accepted"
---
