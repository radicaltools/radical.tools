---
id: "41d43d27-9948-4729-8a80-5fef3f720ac3"
type: "fitness-fn"
label: "No lab regression on phones"
cadence: "triggered"
characteristic: "performance-efficiency"
invocation: "automated"
measure: "lighthouse-lab-mobile"
metrics: |
  web.lab.lcp.max{device=mobile} <= baseline + 10%
  web.lab.tbt.max{device=mobile} <= baseline + 50 ms
  web.lab.cls.max{device=mobile} <= 0.25
scope: "atomic"
trigger: "nightly"
---

Every night nightly.yml runs the sensor lighthouse-lab-mobile (tools/lighthouse-lab.mjs mobile) once for each front end this decision constrains: Lighthouse CI (its mobile default: a mid-range phone on a slow 4G connection, simulated, three runs per main page) on its build (the site's / and /manual.html, the Hub's /, Studio's /), read by radical sense lighthouse. Each element's values are compared with the median of its own last seven nights (the nightly-history artifact); a regression is a finding in the nightly bot pull request. LCP may be at most 10% worse than that median, Total Blocking Time at most 50 ms worse (an absolute margin: on several pages it is 0, where 10% leaves no room), and Cumulative Layout Shift stays under a fixed limit, as a margin without a unit is not a condition radical check reads. There is no lighthouserc file: the model judges.

Tool: Lighthouse CI 0.15.1 (@lhci/cli), radical sense lighthouse
