---
id: "a8f54fd7-75fb-4914-a888-6499f4175f0e"
type: "component"
label: "Federation command"
technology: "Node.js, git"
---

apps/cli/src/federation.ts (radical federation fetch [folder], --quiet, --detach). Reads deps.json (parseDeps) and fetches each dependency's model at its pinned ref (@radical/node-files/gitDeps: a cached partial clone per repository under $RADICAL_CACHE or the user's cache, the model files and the deps.json of one commit), then the models they name in turn, level by level (fetchAll): a model pinned twice comes at the nearest pin, the other is a note, and a path to a repository is resolved only for a dependency on disk. federationOthers marks their elements and relations with their origin (composeFederation, which also notes an id two models have), with their views (otherModelView), and fetchFederation writes them with the commits and the notes into the model folder's .radical/federation.json (writeEditorStateFile, out of git), with the versions the model's milestones keep (atCommits) fetched from where the current ones came. --detach starts it in the background, as the git hooks of radical hooks install do. composeFolder fetches the same for radical check.
