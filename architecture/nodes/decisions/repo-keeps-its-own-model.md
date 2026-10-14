---
id: "60273de4-a5e3-4079-87bd-bc69a280c84f"
type: "adr"
label: "Repo keeps its own model"
alternatives: "Diagrams as images in docs/; no model."
consequences: "The model is reviewed in pull requests like code. Gaps found while using the product on itself become issues. Studio can open the folder directly."
context: "radical.tools says architecture should be a living model that coding agents read before writing code. Its own architecture lived only in READMEs and private notes."
date: "2026-10-06"
decision: "Keep the architecture of radical.tools as a Markdown-folder model in architecture/, registered as a project MCP server in .mcp.json. Coding agents read it before structural changes and update it in the same pull request."
status: "accepted"
---
