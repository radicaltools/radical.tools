---
id: "993e16c9-3f94-4351-82d3-fe4a28f6c9f5"
type: "requirement"
label: "Repository mapping"
action: "The repository's .radical/radical.json shall map elements of the model, its own or another model's of its federation, to the paths from the repository's root that build them, an element without an entry taking the paths of its nearest ancestor that has one; every writer of the file (the CLI, the MCP server, Studio) shall keep the keys it does not know, at the top, in its sections and on entries, and merge a changed entry over the old one"
ears_type: "ubiquitous"
rationale: "A repository may keep settings of its own or of a newer version in the file; a writer that dropped what it did not know lost them (F-0116, round 201–210; the maintainer's decision: every writer keeps unknown keys). Evidence: packages/common/src/repositoryMapping.ts (parseRepositoryFile, serializeRepositoryFile)"
---
