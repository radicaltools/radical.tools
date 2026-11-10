---
id: "482dadb5-2870-478f-8ca9-dad42e0e797f"
type: "scenario"
label: "Assay stages from the agent's calls"
given: "an MCP server on a central model and a repository of code"
then: ".state/assay-run.json says the repository with its units and facts, C4 working then done, Explore, Documents, Processes and State machines skipped, Domain done with one plan refused and its elements counted, Scenarios with the proposals waiting and answered, the later C4 plan counted in C4 while Scenarios stays current, finished after assay_finish, and closed when the client of the second run goes away"
when: "an agent starts an Assay run, applies a C4 plan, has a domain plan refused and applies it, applies a plan of requirements, answers one proposal, applies a later C4 plan, finishes, and starts again and goes away"
---
