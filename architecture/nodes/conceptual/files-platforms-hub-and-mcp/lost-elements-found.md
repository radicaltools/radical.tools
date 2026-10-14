---
id: "0b1dbef8-eb37-4311-b410-07809b7b45d3"
type: "requirement"
label: "Lost elements found"
action: "report the first two as errors and the dangling reference as a warning, each with its file"
ears_type: "unwanted-behaviour"
rationale: "A node file without id or type is silently skipped on loading, so its element is gone; a hand edit or merge can leave views, sequences and slides pointing at nothing. Evidence: packages/common/src/check/index.ts (folder-not-a-node, folder-duplicate-id, stale-reference, staleReferences)"
unwanted_condition: "a node file has frontmatter without an id or a type, two node files hold the same id, or a view, sequence or slide points at an element, relation, view or sequence the model does not have"
---
