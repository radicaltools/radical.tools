---
id: "2dd5746d-b1de-4687-a8ad-d95b9d0b0001"
type: "step"
label: "Commit new screenshot baselines"
children: "sequence"
condition: "if screenshots changed on a pull request"
order: 2
repeat: "0..1"
---

Committed to the branch, then ci.yml is started again on that commit (a GITHUB_TOKEN push starts no workflow).
