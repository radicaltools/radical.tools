---
id: "dbd8b82b-93bc-4320-98b8-31c3ddbb0a0b"
type: "requirement"
label: "Dependencies of a model"
action: "A model folder shall name in its deps.json its own model and the models it depends on: for each, its name, its git repository (an address or a path), the folder of the model in it, and the ref it is pinned to; the ref latest names the repository's newest version tag (v1.10.0 after v1.2.0), or its default branch when it has none, resolved at each fetch, and the version it resolved to is kept with what was fetched and shown with it"
ears_type: "ubiquitous"
rationale: "The dependencies are part of the model's history: a pinned ref, changed in a pull request like code, makes the federation the same for everyone who composes it. Evidence: packages/common/src/federation.ts (parseDeps), apps/cli/src/federation.ts A landscape that should show the released state of every system follows its releases without a pull request per release; a tag pins one when it must not move."
---
