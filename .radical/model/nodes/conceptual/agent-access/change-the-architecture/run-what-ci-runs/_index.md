---
id: "1a1b0330-dcd1-4751-b06a-21c85a2ae389"
type: "step"
label: "Run what CI runs"
children: "sequence"
order: 4
repeat: "1"
---

npm run test:reports and npm run e2e (both write to reports/), then npm run check:architecture: no errors, no baseline raised, no goal lowered.
