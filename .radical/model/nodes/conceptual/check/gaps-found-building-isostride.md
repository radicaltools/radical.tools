---
id: "9ed63781-cf41-4f95-8654-329c75f5e763"
type: "need"
label: "Gaps found building IsoStride"
kind: "stakeholder-note"
source: "Product owner, 2026-11-24"
---

While building IsoStride, a new application, I used the radical tools and noticed a few things:
- the Hub lacks a pack about good UX practices... a common problem is, for example, the same link in 5 places on a page... a separate concern in the Hub would help... refer to some standard
- I had to create the CI/CD myself; the first version was entirely local, and that is fine, but is there a pack in the Hub that speaks about good CI/CD practices, with sensors and so on that make you measure them?
- by default check.json is not very restrictive... it should be more so, especially in new solutions written with the help of the radical tools

I also mean good CI/CD practices such as versioning, showing the version in the application, etc.

As for UX: the look in mobile mode and verifying web vitals in sensors.

One more thing... in IsoStride I had to normalise the metrics to the machine that measured them... there was a script that ran, and from it I got the recalculation... I want this built into Radical.

Translated from Polish. The answers are the options the product owner picked, with the option's text.

Q: Where in the Hub should the UX packs go? Today the groups follow the standard (Secure by Design, API Guidelines, SDLC Standard...), and none covers UX or accessibility.
A: (superseded) A new group, 2 packs: "UX & Accessibility" (ISO 9241-110 + WCAG 2.2): a Usability pack (consistent navigation, duplicate links, link texts, forms and errors, empty states) and an Accessibility pack (WCAG 2.2 AA, axe-core, EAA).
Q: Web Vitals and accessibility are in the Frontend stack pack (Tech Radar) today. How should they be split with the new "UX & Accessibility" group, and where does the look on mobile go?
A: 3 packs, moved from Frontend: Usability (navigation, links, forms, errors) · Accessibility (takes axe and the keyboard, WCAG 2.2 AA) · Mobile & perceived performance (takes Web Vitals lab and field separately for mobile and desktop, Reflow 320 px, touch targets, screenshots on phones). Frontend stack keeps the framework, rendering, browsers and the JS budget.
Q: How should the sensors measure Web Vitals and UX? Today the CLI has the command, json and playwright adapters; a condition (such as `web.lcp.p75{device=mobile} <= 2500 ms`) is to be judged by `radical check`, not by a script.
A: Only lighthouse: `radical sense lighthouse` reads Lighthouse/LHCI reports (LCP, CLS, TBT, the score, separately for mobile and desktop, per page), without CrUX: data from real users stays with one's own RUM (an SQL query into json). The UX measurements (duplicate links, overflow, touch targets) are written by the packs' Playwright tests as radical-metrics/1 and read by the json adapter.
Q: A new "CI/CD pipeline" pack (SDLC Standard): pipeline as code, required checks and branch protection, build once and promote the artifact, OIDC instead of static secrets, the pipeline's time and reliability. Where should the sensors take the numbers from?
A: The github-actions adapter: `radical sense github-actions` reads, through `gh`, the workflow runs and the branch protection and gives metrics (ci.pr.duration.p90, ci.main.success.rate, ci.required-checks). Other platforms (GitLab) add adapters by pull request.
Q: How restrictive should check.json be for new solutions? Today setup writes none, and without it most rules are only warnings and there are no goals.
A: A strict profile for new ones: `radical setup` on a repository without code and Forge write check.json: every rule = error (also test-skipped/not-run, metric-stale/not-measured, concern-unaddressed), all goals 100%. Existing code (setup on a repository with code, Assay): the same rules as error, but with baselines from the first run, which --ratchet only lowers.
Q: How should normalising the metrics to the machine's speed be built in (today in IsoStride a script times a fixed piece of work and the unit tests' time limit is multiplied by the factor)?
A: The machine sensor and `scaled` in the condition: `radical sense machine` measures Radical's fixed work (before and after the tests, the slower one wins) and writes the metric machine.speed; `radical sense machine --reference` on the author's machine saves the reference to .radical/radical.json. In the model the condition says outright that it scales: `test.duration.max{kind=unit} <= 100 ms scaled`. The engine multiplies the limit (never below ×1), and `radical check` and the Inspector show "100 ms × 2.4 = 240 ms". The measurements stay raw.

Asked after that, on 2026-11-24: if I ran Forge now, would it have the good UX and SDLC practices in it at once?
Q: How should Forge bring the good UX and SDLC practices at once? Today the AI picks only the packs the description clearly names, and the rest comes out only as concern-unaddressed errors after Forge.
A: Baseline packs + Review: the Requirements stage always proposes (checked, can be unchecked) the baseline packs of every system: CI/CD pipeline, Test strategy, Release and versioning, Code quality gate, and with an interface for people Usability, Accessibility and Mobile. In addition the Review stage lists the concerns the model triggers (concern-unaddressed) and asks their questions before it ends.

Q: The new packs raise four concerns in radical.tools' own model (Usability, Accessibility, Mobile and perceived performance, CI/CD pipeline), so concern-unaddressed rose above its baseline. What to do about it?
A: Settle all 4 now: the questions of the four packs for radical.tools asked one by one, and the packs imported with tests. (no requirement)
Q: CI/CD pipeline for radical.tools (1/3): how does a build reach the environments? Today deploy.yml builds Studio, the Hub and the site and uploads them to S3/CloudFront, and release.yml builds the npm packages and the installers.
A: I have only 1 environment ... it builds only on main; do you have to change anything here? (no requirement)
Q: CI/CD pipeline (2/3): where does the pipeline first run?
A: mirrored: every pull-request step in CI is a package.json script, and npm run verify runs them all locally. (no requirement)
Q: CI/CD pipeline (3/3): the thresholds the github-actions sensor measures every night (our last 30 days: pull-request p90 9.7 min, main green 95.9%, reruns 4.6%).
A: 15 min / 90% / 5%. (no requirement)
Q: Usability (1/5): how do people move around our front ends (Studio, the Hub, the radical.tools site)?
A: don't change anything here (no requirement)
Q: Usability (2/5): how many times may the same link repeat in the content of one page (outside the navigation and the footer)?
A: limit 2. (no requirement)
Q: Usability (3/5): how must a link's name say where it goes?
A: match it to how it is now (no requirement)
Q: The remaining questions of Usability, Accessibility and Mobile: match them all to how it is now?
A: Yes, everything as it is. (no requirement)

The checks found 74 serious and critical axe violations (WCAG 2.2 AA) on Studio, the Hub and the site, the Hub's pack cards opened only with a mouse, 216 small targets in Studio and 113 in the Hub, and the site scrolling sideways at 320 px; they were tracked with a due date.
Q: (asked after the findings) Fix them?
A: ok fix the axe and WCAG issues (no requirement)
Q: Besides axe there are two WCAG criteria of the layout: target size (2.5.8, at least 24×24 px: Studio 216 small, the Hub 113) and reflow at 320 px (the site scrolls sideways by 37 to 56 px because of the footer links). Fix them too?
A: Everything, Studio too: all targets to 24 px and reflow everywhere; Studio gets a little less dense. (no requirement)
