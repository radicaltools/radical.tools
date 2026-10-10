---
id: "ba0d2e93-b48a-49cd-bc41-4f6f522a70f7"
type: "adr"
label: "Two built-in metamodels"
alternatives: "Keep C4 + DDD loadable as a hidden preset: no change for existing models, but a third metamodel stays in the code. Rename the id too: breaks every saved model and Hub concept, or needs a migration everywhere. Keep governance and c4-ddd as aliases of radical for --metamodel: friendlier to old configurations, but two names for one thing."
consequences: "One fewer choice when a model is created, and the default is called what the product is: the picker reads Radical or C4. Models on C4 + DDD gain the governance types on their next load; nothing in them becomes invalid. Edited copies of the default are named \"Radical (custom)\". An MCP configuration that passes --metamodel governance or c4-ddd stops with the usage message and must switch to radical. Saved files keep the old name text until they are saved again; the loaded name comes from the preset."
context: "Studio offered three nested presets, C4, C4 + DDD Domains and C4 + DDD + Governance, with the last as the default. The middle one added only the Domain and Entity types, which the default holds too, so the choice asked people to understand three notations to pick one, and the default had a name that described its history rather than the product. The product owner asked for two: the default under the product's name, and plain C4."
date: "2026-10-10"
decision: "Two built-in metamodels: Radical (the former C4 + DDD + Governance, the default) and C4. Radical keeps the id c4-ddd-governance-builtin, since files, folders and 128 Hub concepts store it; only its name changes (RADICAL_METAMODEL_NAME = \"Radical\"). C4 + DDD leaves the pickers; its builder stays as the base Radical extends, and a document saved with its id loads under Radical. The MCP server's --metamodel takes radical or c4 (default radical); the old values c4-ddd and governance are refused."
status: "accepted"
---
