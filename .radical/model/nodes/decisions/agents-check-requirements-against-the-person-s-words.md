---
id: "fd45dec2-52d6-4321-b195-e2b41a1b71df"
type: "adr"
label: "Agents check requirements against the person's words"
alternatives: "A reviewer with a language model in CI (independent, but needs an API key and costs at every pull request). A person reviewing in Studio's Inspector (most reliable, but only when someone looks). A deterministic rule in radical check (cannot judge meaning)."
consequences: "A requirement can be checked against what was said, by the agent now and by a person later in Studio. The check is the agent's own reading, so some errors still pass; it costs one call and a reading of the changed requirements per change."
context: "An agent turns what a person says into EARS requirements and ADRs and then builds from those. In the benchmark, details the client stated (a value of 0, an e-mail address kept on the order) were changed on the way into requirements and decisions, and the code followed the changed text. The needs could not show it: they held the first request, and the answers to the agent's questions only in its own summary or nowhere."
date: "2026-11-12"
decision: "A need keeps the person's words: each question the agent asks about it and the person's answer go into its description word for word, not summarised. Before it writes code, the agent calls review_requirements: it lists each requirement added or changed on the branch, and each one a changed need leads to, with its sentence next to the whole text of every need it derives from, and asks the agent to confirm each or correct it where it adds, drops or changes a value, a number, a range, a state or who may do what. The agent corrects the requirement, or asks the person when the need does not settle it and adds the answer to the need."
status: "accepted"
---
