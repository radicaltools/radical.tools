---
id: "68e6db69-61b2-4a9f-8780-e07dd4a715df"
type: "requirement"
label: "Open the running application"
action: "the MCP server shall open it in a browser it drives (the user's Chrome, else Playwright's Chromium), in a fresh session, signed out, as the path's test will start, start the path, and return the screen: its address, title, headings, the start of its text and each control it can act on with a reference, its role and its name, keeping its screenshot in the central repository's .radical/assay/explore/; and shall refuse an address of another host"
ears_type: "event-driven"
rationale: "The server, not the agent, sees the page, so every screen is evidence (ADR Assay explores the running application)."
trigger: "an agent calls assay_explore during an Assay run with the address of a web application running on this machine (localhost, a loopback address or a .localhost name) and a name for the path"
---
