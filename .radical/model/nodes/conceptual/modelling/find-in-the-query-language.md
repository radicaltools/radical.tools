---
id: "827d6a5b-4ffc-45a2-b71c-bdfd57e2e6ee"
type: "requirement"
label: "FIND in the query language"
action: "the query language shall return the hits as Quick Search finds them, prefixes included, each with its kind, id, label and the words around its match"
ears_type: "event-driven"
rationale: "An agent looking for \"the payment thing\" needs the same loose search the user has, not an exact WHERE. Evidence: packages/common/src/ai/queryLanguage.ts (FIND); packages/common/src/search.ts"
trigger: "an agent or the AI assistant calls search_model with FIND and some words"
---
