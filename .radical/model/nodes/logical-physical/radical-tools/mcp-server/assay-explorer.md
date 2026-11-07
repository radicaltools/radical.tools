---
id: "f971b2de-614a-44d5-8b34-09777f4523c6"
type: "component"
label: "Assay explorer"
technology: "TypeScript, playwright-core"
---

apps/mcp/src/explore.ts: the browser of an Assay run's Explore stage. It opens an application running on this machine with Playwright (the user's Chrome, else Chromium), reads each screen (address, title, headings, the controls with their references, roles and names), keeps its screenshot in <central repository>/.radical/assay/explore/, performs the agent's actions as the steps of named paths (expect checks a text the screen shows, which the path's test asserts), and refuses other hosts and plainly destructive controls. The paths' tests are written by @radical/assay (explore.ts).
