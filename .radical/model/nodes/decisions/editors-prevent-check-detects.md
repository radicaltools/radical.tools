---
id: "938c5612-ec43-4d40-bea5-479f2c9f8c14"
type: "adr"
label: "Editors prevent, check detects"
alternatives: "Only editor validation: misses merges, hand edits and metamodel changes, and cannot demand completeness. Only a CI check: users would build invalid models and learn about it in the pull request."
consequences: "Something Studio lets a user build and its own validation then flags stays a Studio bug, not a job for the check. The check runs the same validator (validateModel) as Studio's Validation list, with the same severities; a project raises them in its config. Completeness rules are warnings by default and become a gate per project with a baseline that only goes down. Amended 2026-10-21 (the maintainer's decisions D3 and D5): narrowing the metamodel below what the model holds is not prevented but confirmed, Studio listing first what it breaks and the MCP server reporting it with the write, so the elements it leaves breaking a rule are then flagged by Validation, get_issues and the check; an untyped relation where the metamodel has types for its pair is flagged as a warning, Studio's canvas asking for the type where several fit."
context: "Studio and the MCP server already keep the metamodel while a model is edited through them. A model also changes in other ways: hand edits of the Markdown files, a git merge of two valid branches (one deletes an element, the other adds a relation to it), a script, an older Studio, a changed metamodel. And completeness (a requirement without a scenario) is a legal state while someone is still writing, so no editor can refuse it."
date: "2026-10-14"
decision: "Studio and the MCP server prevent what breaks the metamodel at the moment of the edit and say why. `radical check` detects, at the gate: what came in another way, and completeness gaps, which editors only show. Each rule is one of the two kinds, and both kinds live in one catalogue in @radical/common."
status: "accepted"
---
