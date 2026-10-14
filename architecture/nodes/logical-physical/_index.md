---
id: "c3073e61-3a0b-4d1f-980b-a65f1e4992f5"
type: "group"
label: "Logical & physical"
---

What radical.tools is made of and how it is built, in C4: the people who use it, the external systems it talks to, and the radical.tools system with its containers (which name their technology), components and shared packages. The metamodel has no deployment node type yet, so where things run is modelled as external systems with relations: AWS serves the three web sites, GitHub builds, tests and releases (GitHub Releases for the desktop installers), the VS Code Marketplace and the npm registry distribute the extension and the MCP server; the CLI, MCP server and desktop app run on the user's machine.
