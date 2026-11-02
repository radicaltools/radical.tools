---
id: "5601c84d-7de5-4b04-a771-dfdb6a6abc7c"
type: "requirement"
label: "Search words loosely"
action: "Quick Search shall match every word typed, in any order, ignoring case and accents, match the initials of an element's name, mark the matched part of each hit, and show the words around a match found in a description or a property"
ears_type: "ubiquitous"
rationale: "Names are remembered in parts and typed without Polish or German letters; a hit found by its description has to show why it is listed. Evidence: packages/common/src/search.ts (foldText, matchField, snippet)"
---
