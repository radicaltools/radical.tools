---
id: "4d16f076-8787-4261-89a1-f7896a7c03be"
type: "requirement"
label: "Narrow search with prefixes"
action: "Studio shall limit the hits to views (v:), folders (f:), elements (e:), relations (r:), sequences (s:), presentations and slides (p:) or milestones (m:); to the elements and relations of the view shown (@) or of a named view (in:); to elements of a type (type: or t:) or with a property value (the property's key or name, a colon and the value); and suggest the prefixes, views, types and values that fit what is typed, Tab taking the first"
ears_type: "event-driven"
rationale: "In a model of a thousand elements a word matches too much; VS Code users narrow their palette the same way. Evidence: packages/common/src/search.ts (parseSearch, searchSuggestions)"
trigger: "the user types a prefix in Quick Search"
---
