---
id: "0dd058ca-b674-4a65-8b4e-07d87e50a5b0"
type: "component"
label: "Explore command"
technology: "Node.js, git"
---

apps/cli/src/explore.ts (radical explore): prepare builds the project once at the commit (crucible.json's explore.build), copies what runs need (explore.copy) into a folder per run with its ports, and writes the round's BRIEF.md (the project's brief, the commit, the commits and model elements changed since the last round's commit, grouped as candidate areas, open findings and questions, setup, rules, the report's JSON form), a PROMPT.md per run and round.json; verify serves a run's build (explore.serve) on its port, runs its scripts and stops the server; record writes a run's report as finding files with copies of their scripts. The agents are started by the agent session, which follows .claude/skills/crucible-explore/SKILL.md.
