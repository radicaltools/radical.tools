---
id: "fa30059d-5ec9-4a8c-9821-b5e3db19c812"
type: "adr"
label: "Pages held to the Core Web Vitals"
alternatives: |
  1. Assertions in lighthouserc: the limits then live in a CI file, apart from the decision, and the model cannot show them.
  2. Lighthouse's performance score as the gate: one number that mixes metrics and changes its weights between versions.
  3. Field data only (CrUX or RUM): the truth, but only after release, and no check of the pull request that caused a regression.
  4. A commercial RUM service (SpeedCurve, Datadog, New Relic): the same data without our own endpoint, at a price per page view; its export then writes the measurements.
concern: "mobile-performance"
consequences: |
  • A regression fails the pull request that causes it, with the page, the device class and the value.
  • The numbers live in the model: changing the budget is a change of the decision's details, not of a CI file.
  • Lab runs add minutes to every pull request (three runs a page, per device class); keep the list of main pages short.
  • The lab simulates one phone and one network; only the field data, when there is any, says what users get, and it arrives days after a release.
  • A runner of another class shifts lab timings: TBT's limit follows it, LCP's does not.
context: "This element is a web front end that people open on their own phones and computers, over networks they do not choose. The forces: most visits come from mid-range phones on mobile networks, where every image and script costs seconds that a developer's laptop never shows; what users feel is how soon the main content appears (LCP), how soon a tap answers (INP) and whether the page jumps while it loads (CLS), and Google measures exactly these at the 75th percentile of real visits; lab runs on every change are repeatable but simulate one phone on one network, field data is the truth but arrives days later and only once the page is live; lab timings depend on the CPU of the machine that runs them; people zoom, use small screens and hit targets with a thumb, so a layout that scrolls sideways at 320 CSS px or a 16 px icon button fails some of them (WCAG 2.2: Reflow, Target Size); and a layout that breaks on a phone is seldom seen by a team that works on desktops."
date: "2026-11-24"
decision: "Pages are held to the Core Web Vitals at web.dev's \"good\" thresholds, for phones and desktops, each against the budget, each device class judged on its own: Largest Contentful Paint within 2500 ms, Interaction to Next Paint within 200 ms and Cumulative Layout Shift at most 0.1, at the 75th percentile of real page loads over 28 days. In the lab, on every pull request: Lighthouse CI collects three runs of each main page (Lighthouse's mobile default for phones, its desktop preset for desktops) and only collects; radical sense lighthouse reads the reports, and the fitness functions' conditions judge the medians, so the limits live in the model and not in lighthouserc. The lab is held with no regression against the main branch. The lab has no INP: Total Blocking Time within 200 ms stands in for it, its limit scaled to the speed of the runner, because TBT is CPU time; LCP is not scaled, and the runners are kept of one class. Field data: none yet: the lab stands in until there is real-user data. With our own real-user monitoring, the page reports with the web-vitals library to our endpoint, and a nightly job writes the 75th percentiles per page group and device class as radical-metrics/1 for radical check. The Chrome UX Report is not read by any check: it covers only origins with enough Chrome traffic, trails by 28 days and cannot be tied to a release; PageSpeed Insights shows it to anyone who looks. The JavaScript budget per route is decided in the Frontend stack pack; accessibility as a whole in the Accessibility pack."
status: "accepted"
---
