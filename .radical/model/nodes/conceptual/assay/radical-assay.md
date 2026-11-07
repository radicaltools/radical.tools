---
id: "320cca7d-ae05-48b4-9cdf-c7bc1d5a0d55"
type: "need"
label: "Radical Assay"
kind: "stakeholder-note"
source: "Product owner, 2026-11-02"
---

"I already have Radical Forge... I want to do something like it, but for existing solutions: reverse engineering. What do you suggest?" After the proposal: "Radical Assay is fine." "Be ready to analyse multi-repo projects." "Remember that it has to be available from MCP." Settled, asked one by one: the result of several repositories as a federation or a central model, chosen when a run starts; repositories only from local directories; the first version as in the ADR (C4 from npm workspaces, scenarios from tests with the requirements they verify proposed for acceptance, linking of HTTP APIs and packages, the mapping); one pull request; the agent hands the server a plan it checks and writes. Then: "For now a repository with a central model, not federation."
Translated from Polish.
Later the same day: "How does it work on legacy code, e.g. VB6?" After the proposal (code cited by the agent and checked by the server for any language first, a VB6 extractor second): "Start with 1."
Translated from Polish.
On 2026-11-03: "Review this prototype... improve the quality of reverse engineering, from new technologies and old ones alike." Measured first on public repositories of several stacks and ages, on which the prototype found no unit at all.
Translated from Polish.
On 2026-11-06: "Will the solution work with different technologies, will it be ready for multi-repo, for uploading files by hand? Links to documentation?" Settled, asked one by one: documentation as a source of hypotheses, kept as a copy so its citations can be checked; only public links, pages behind a login exported by the user; a folder or a .zip given by hand; in the same pull request.
Translated from Polish.
On 2026-11-03: "Can you add a stage in which you click through the application ... run locally?" Settled, asked one by one: the Assay server drives the browser and the agent says what to click; screens become mockups, the paths requirements with scenarios for the user to accept, and Playwright tests in the application's repository; the application runs on a test database, so the agent clicks freely but for what is plainly destructive; local addresses only; a pull request of its own. "The application may be standalone", but the first version is web only. On 2026-11-06: "I would also like it to be able to click through a desktop application", then: "OK, for now only web ones."
Translated from Polish.
