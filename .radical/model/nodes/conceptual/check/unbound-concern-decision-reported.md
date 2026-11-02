---
id: "dd13d127-3eec-4dad-9503-cfc37aea8d91"
type: "requirement"
label: "Unbound concern decision reported"
action: "report concern-unbound for that ADR, naming the fitness functions that implement it and, when its pack is known, the elements the concern applies to as where to bind it"
ears_type: "unwanted-behaviour"
rationale: "A decision bound to nothing settles nothing and constrains no code, yet passes every other rule: its fitness functions implement it and nothing asks what it is about. ADR Hub concern packs and critic."
unwanted_condition: "an accepted ADR marked with a concern constrains no element, as when a concern pack was imported before the elements it is about existed (Radical Forge before its C4 stage) or its links were removed"
---
