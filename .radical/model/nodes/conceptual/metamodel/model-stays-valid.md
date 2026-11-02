---
id: "ed9cf496-4559-4eed-bbac-8ba6d7d76300"
type: "need"
label: "Model stays valid"
kind: "brief"
---

The model is only useful if it is consistent. When I drop a component on the bare canvas or connect two things our rules do not allow, the tool should refuse and tell me why instead of drawing it anyway. For a model I imported or whose rules I just changed, I want a list of everything that breaks the rules, so I can fix it.

I need the tool to know the C4 rules (what can sit inside what, which elements may be connected, how many of a type are allowed) and to refuse anything that breaks them with a message telling me why, instead of silently drawing something that is wrong. If my team uses its own metamodel, the same checks and the property forms should follow it.
Reconstructed from: manual#elements, manual#relations, manual#metamodel, manual#properties, landing (Metamodel 01, one validated graph). Merged on 2026-10-06 from the duplicate needs "Model that stays valid" and "Model stays valid".
