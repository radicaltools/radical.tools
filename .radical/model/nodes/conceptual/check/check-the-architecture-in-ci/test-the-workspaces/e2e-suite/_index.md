---
id: "7c077b3c-b485-4a88-b02e-d8aec3e028ff"
type: "step"
label: "E2E suite"
children: "sequence"
condition: "for each of the four shards"
order: 2
repeat: "1..n"
---

Playwright, report in reports/e2e.json; unless the pull request is labelled skip-e2e.
