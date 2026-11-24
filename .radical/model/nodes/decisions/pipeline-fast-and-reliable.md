---
id: "ec21907b-133e-4901-8585-dd34b5c52330"
type: "fitness-fn"
label: "Pipeline fast and reliable"
cadence: "triggered"
characteristic: "performance-efficiency"
invocation: "automated"
measure: "github-actions"
metrics: |
  ci.pr.duration.p90 <= 15 min
  ci.main.success.rate >= 90 %
  ci.rerun.rate <= 5 %
scope: "holistic"
trigger: "nightly"
---

Every night nightly.yml runs radical sense run --trigger nightly, which runs the built-in github-actions sensor for this measure line; radical check judges the figures against the conditions here.

Every night radical sense github-actions reads the completed runs of the last 30 days through the GitHub CLI: for each pull-request commit the time from the start of its first run to the end of its last, the share of commits on main whose runs all succeeded (cancelled and skipped runs left out), and the share of runs with a run attempt above 1; radical check judges them against the model. When the time goes over, look first at caching (a cache key that misses on every run), at jobs that could run in parallel, and at the slowest job of the slowest runs; when reruns go up, find the jobs that are rerun most and treat their tests as the Test strategy pack decides for flaky tests.

Threshold: Over the last 30 days: the 90th percentile of a pull-request commit's pipeline time at most 15 minutes, at least 90 % of the commits on main with every run successful, at most 5 % of runs with a second attempt

Tool: radical sense github-actions and radical check, in a scheduled GitHub Actions workflow
