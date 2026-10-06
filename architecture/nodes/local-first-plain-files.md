---
id: "38f9a288-f924-4f37-96fd-bd1d78660415"
type: "adr"
label: "Local-first plain files"
alternatives: "A hosted backend with accounts and real-time collaboration."
consequences: "Models live in git and diff in pull requests. The project runs no servers for user data. Collaboration happens through git, not live co-editing."
context: "Architecture models should be versioned with the code they describe and should open without sign-up."
decision: "Store a model as one .radical JSON file or a Markdown folder (one file per element plus JSON sidecars), on disk or in browser storage. No backend and no account."
status: "accepted"
---
