---
id: "7d3c36b3-7e62-46a9-af26-2556937a5d37"
type: "fitness-fn"
label: "No lab regression on desktops"
cadence: "triggered"
characteristic: "performance-efficiency"
invocation: "automated"
measure: "lighthouse-lab-desktop"
metrics: |
  web.lab.lcp.max{device=desktop} <= baseline + 10%
  web.lab.tbt.max{device=desktop} <= baseline + 50 ms
  web.lab.cls.max{device=desktop} <= 0.1
scope: "atomic"
trigger: "nightly"
---

Every night nightly.yml runs the sensor lighthouse-lab-desktop (tools/lighthouse-lab.mjs desktop) once for each front end this decision constrains: Lighthouse CI (its desktop preset, three runs per main page) on its build (the site's / and /manual.html, the Hub's /, Studio's /), read by radical sense lighthouse. Each element's values are compared with the median of its own last seven nights (the nightly-history artifact); a regression is a finding in the nightly bot pull request. LCP may be at most 10% worse than that median, Total Blocking Time at most 50 ms worse (an absolute margin: on several pages it is 0, where 10% leaves no room), and Cumulative Layout Shift stays under a fixed limit, as a margin without a unit is not a condition radical check reads. There is no lighthouserc file: the model judges.

Tool: Lighthouse CI 0.15.1 (@lhci/cli), radical sense lighthouse
