---
id: "2a496bde-c1cf-4a4a-b21f-c284328d0946"
type: "need"
label: "Evidence from CI out of sight"
kind: "stakeholder-note"
source: "isostride, a team using radical CLI 0.5.0 with the git hooks; questions answered by the product owner, 2026-11-27"
---

Subject: --from-ci fails silently, and check --report overwrites what Studio shows

Hi, I'm using radical CLI 0.5.0 with the git hooks from radical hooks install. For a long time Studio showed stale test results, and nothing told me why. We found two causes. The fix was in our setup, but the tool made both problems hard to see.

1. --from-ci finds nothing, and nobody is told

The hooks run:

radical check <model> --from-ci --quiet --detach >/dev/null 2>&1 || true

Our CI never uploaded test reports as GitHub artifacts. They went to S3 and were read from there by the verdict step. When I ran the command by hand, it said the artifacts of runs … hold no test report. Through the hooks that message never shows up, and Studio keeps showing whatever was saved last, with no hint of where it came from or how old it is.

Suggestions:

In Studio, show where the test results come from (a local --report or a CI run, with its id), plus the commit and the time.
Warn in Studio, or in some status command, when the last --from-ci fetch found no reports.
In the docs for --from-ci and hooks install, say plainly that CI has to upload the reports as artifacts, with an example GitHub Actions step and the "ci": { "artifacts": [...] } setting in radical.json.

2. check --report always writes to .state/test-results.json

We have a test that checks our merge gate. It runs radical check <model> --report <a deliberately broken report> --format json and expects a failure. Because check saves every report it reads, each local test run left "1 failed" in Studio. That local report also wins over CI's results for the same and older commits, so the hooks could not have fixed it even with working artifacts. Our workaround is to run that test on a copy of the model in a temporary directory.

Suggestions:

A read-only flag, for example --no-keep, for using check as a gate without changing what Studio shows.
Or: don't save reports when --format json is used.

Question: does --from-ci also read radical-metrics/1 files (written by radical sense --out) from CI artifacts? Or are metrics measured in CI meant to reach Studio some other way? Right now our metrics show up only when they are measured locally.

Thanks!

---
Questions to the product owner and the answers (2026-11-27, translated from Polish; each answer is the option picked, with its description as offered):

Q: Point 1 from isostride: when radical check --from-ci (run by the git hooks with --quiet, output to /dev/null) finds nothing or fails, no trace is left, and Studio shows old results without a word. How should a failed fetch be shown? (Other options offered: record + chip only, without a line in radical setup --status; the hooks write a log to .state/hooks.log instead of /dev/null, nothing in Studio.)
A: Record + chip + status (Recommended): every --from-ci attempt, --quiet included, writes .state/ci-fetch.json (time, HEAD, outcome, CI's message). The Inspector's Tests chip marks a failed last fetch and gives the message and what to do (e.g. "CI does not upload test reports as artifacts"). radical setup --status prints the last fetch too. Plus "· local" on the chip for --report results.

Q: Point 2 from isostride: radical check --report always writes .state/test-results.json, and --metrics always adds to .state/measurements.json. A gate test with a deliberately broken report pollutes what Studio shows and outweighs the results of CI until the next commit. How should check be usable as a gate without writing? (Other options offered: no write with --format json, as isostride proposed; both.)
A: A --no-keep flag (Recommended): an explicit flag: check reads --report and --metrics and judges, but writes nothing beside the model (neither test-results.json nor measurements.json). --evidence, --ratchet and --adopt still write, as they are explicit writes. The default behaviour stays as it is.

Q: isostride's question: metrics measured in CI (radical-metrics/1 files from radical sense --out) do not reach Studio, as --from-ci reads only test reports from the artifacts. What to do? (Other options offered: a separate command such as radical sense fetch --from-ci; not now, answer isostride to download them and pass them with --metrics.)
A: --from-ci reads the metrics too (Recommended): the same artifacts (ci.artifacts in radical.json): radical-metrics/1 files go to .state/measurements.json, merged by the time of measurement (the latest wins, as today). The hooks get them for free. The Measurements chip says which come from CI (run, commit).
