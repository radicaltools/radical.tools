---
id: "d6dc1eff-89c9-46c2-a767-62467b0471c8"
type: "adr"
label: "Agent answers brief, details on request"
alternatives: "Keep full answers and add a BRIEF keyword (agents rarely choose it). Shorten the same text (a third smaller at best). A page size on LIST (the agent pages through the same fields)."
consequences: "An agent's first calls cost a fraction of what they did; one that needs a long enum, a reference target or a viewpoint's chain asks for that type. A caller that read every field from LIST adds FULL."
context: "Agents read the model through search_model and get_model_summary. Both answered with everything: every field of every element listed (an element twice in GET NEIGHBORS), and the whole metamodel at every summary. In the benchmark this filled the agent's window within a few calls and forced compactions that lost its work."
date: "2026-11-12"
decision: "search_model's LIST and traversals (GET NEIGHBORS, DEPENDENCIES, DEPENDENTS) answer each element in brief: id, type, label, parent, technology, origin, status and one sentence of at most 160 characters (a requirement's EARS sentence, an ADR's decision, else the description), and each relation once with its type and ends. GET NODE and a trailing FULL give everything. get_model_summary gives each node and relation type in one line (parents, property keys, short enum options, pairs) and the viewpoints by name; its types parameter gives the whole definition of the types named. Studio's chat and Forge keep their context message."
status: "accepted"
---
