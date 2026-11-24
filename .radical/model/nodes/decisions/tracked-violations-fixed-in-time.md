---
id: "76785b6e-2bd8-45ce-8bef-c528ce7354f9"
type: "fitness-fn"
label: "Tracked violations fixed in time"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
measure: "a11y-deadlines"
metrics: |
  a11y.known.overdue <= 0
  a11y.known.too_late <= 0
  a11y.known.no_issue <= 0
scope: "atomic"
trigger: "pull-request"
---

A nightly job reads apps/e2e/a11y-known.json, the list the axe check accepts, and counts the entries past their due date, those due more than 30 days after they were found, and those without an issue; it writes the counts to apps/e2e/a11y-known.json and fails on any, printing the entries concerned. A fixed violation is taken off the list in the change that fixes it; the axe check then fails if it comes back. Bind it with radical sense json apps/e2e/a11y-known.json --metric a11y.known.overdue=overdue --metric a11y.known.too_late=too_late --metric a11y.known.no_issue=no_issue --metric a11y.known.open=open, and the conditions a11y.known.overdue <= 0, a11y.known.too_late <= 0 and a11y.known.no_issue <= 0. Runs on Linux or macOS (jq 1.6 or later).

Threshold: a11y.known.overdue = 0, a11y.known.too_late = 0 and a11y.known.no_issue = 0: no tracked violation is past its due date, none is due more than 30 days after it was found, and every one names an issue

Tool: jq in a scheduled CI job, measured by radical sense json

```bash
#!/usr/bin/env bash
# Nightly: the accessibility violations tracked in apps/e2e/a11y-known.json, e.g.
#   [{ "rule": "color-contrast", "state": "checkout", "issue": "https://example.org/issues/412", "found": "2026-11-02", "due": "2026-12-02" }]
set -euo pipefail
known=apps/e2e/a11y-known.json
fix_days=30
mkdir -p reports
[ -f "$known" ] || { echo '{"open":0,"overdue":0,"too_late":0,"no_issue":0}' > apps/e2e/a11y-known.json; exit 0; }
jq --arg today "$(date -u +%F)" --argjson days "$fix_days" '
  def day: strptime("%Y-%m-%d") | mktime;
  { open: length,
    overdue: [.[] | select(.due < $today)] | length,
    too_late: [.[] | select((.due | day) - (.found | day) > $days * 86400)] | length,
    no_issue: [.[] | select((.issue // "") == "")] | length,
    entries: [.[] | select(.due < $today or (.issue // "") == "")] }' "$known" > apps/e2e/a11y-known.json
jq -e '.overdue == 0 and .too_late == 0 and .no_issue == 0' apps/e2e/a11y-known.json > /dev/null || {
  jq . apps/e2e/a11y-known.json
  echo "::error::tracked accessibility violations past their due date, due more than $fix_days days after found, or without an issue"
  exit 1
}
```
