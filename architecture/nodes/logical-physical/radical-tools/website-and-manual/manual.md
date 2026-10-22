---
id: "b66354fc-6237-40a6-bd7d-3ecd3dd64a1e"
type: "component"
label: "Manual"
technology: "Static HTML, CSS, docs.js"
---

apps/web/manual.html, reference.html, docs.js, style.css and screenshots/: the user documentation as two pages that share one sidebar layout. manual.html is the guide (about 8,000 words): one short section per feature with what it is for, a light and a dark screenshot shown by theme, how to use it, and at most one "Good to know" box, in the groups Start, Modelling, Views, Work faster and Extend; its contents sidebar ends with links into the reference. reference.html holds what is looked up rather than read: tables of the element and relation types with their allowed pairs, the viewpoints, the summary-template tokens, the rules Studio refuses, lists as issues and radical check reports, the radical check options and check.json, the base of Changes on branch, the MCP server's setup and tools, editing beside an agent, file formats, deep links, keyboard shortcuts and install. Edge-case behaviour (undo semantics, merge rules, edits in a milestone) is not written into either page; the model's requirements and scenarios hold it. docs.js, shared by both pages, lands again on the #section a link names once the web fonts have loaded and highlights the contents entry of the section in view. The Radical Crucible commands are documented for contributors in docs/CRUCIBLE.md.
