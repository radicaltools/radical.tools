---
id: "a4fd393a-bafe-4c7e-a795-4c93e467e60a"
type: "adr"
label: "Groups inside a system"
alternatives: "Model the shared packages as a container: wrong in C4, since a container is something that runs or stores data. Allow the group only in this model's metamodel: editing a built-in preset forks it, so the model would stop getting preset updates (ADR Edited presets fork). Groups inside containers as well: not needed yet, and nested groups inside a container change how the canvas fits and lays out components."
consequences: "Every model on a built-in preset gets the rule on its next load, since presets refresh on load; nothing in an existing model becomes invalid. The metamodel diagram draws one more Contains edge (System → Group), and the e2e counts were raised to match. A system can now hold parts that are not C4 containers, which is a convention, not a C4 level."
context: "The shared packages are code of radical.tools, so in its own model they belong inside the radical.tools system. They are components, which may sit in a container, web app or group but not directly in a system, and the C4 preset allowed a group only at the root or in another group. The model had to keep them in a group outside the system. Structurizr allows groups inside a software system for the same purpose."
date: "2026-10-06"
decision: "The C4 preset, which the C4, C4 + DDD and governance presets share, allows a group inside a system (packages/common/src/metamodel/presets/c4.ts). Groups still cannot sit inside a container, web app or component."
status: "accepted"
---
