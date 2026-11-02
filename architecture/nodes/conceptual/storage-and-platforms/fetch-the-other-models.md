---
id: "2202a5bc-463f-48c6-82f7-641b80d8962b"
type: "requirement"
label: "Fetch the other models"
action: "the CLI shall fetch each dependency's model at its pinned ref from git into a cache, theirs too, and write their elements and relations, each marked with origin <name>@<commit>, with the commits and the notes on what was left out, into the folder's .radical/federation.json, and say how many it wrote"
ears_type: "event-driven"
rationale: "Studio and the MCP server open one folder; the composed one shows the system with everything it relates to. Evidence: packages/common/src/federation.ts (composeFederation), packages/node-files/src/gitDeps.ts, apps/cli/src/federation.ts"
trigger: "the user runs radical federation fetch on a model folder with a deps.json, or a git hook does after a checkout, a commit, a pull or a rebase"
---
