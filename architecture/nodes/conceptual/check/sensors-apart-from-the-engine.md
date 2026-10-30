---
id: "224b849a-621f-456d-bee7-2b15f10fd82f"
type: "need"
label: "Sensors apart from the engine"
kind: "stakeholder-note"
source: "Product owner, 2026-10-29"
---

A fitness function depends on many factors, and no single tool tests it. Separate the sensors from the engine that evaluates them: the engine is in Radical, the sensors need adapters. The adapters are built into the CLI and live in the radicaltools monorepo, where users can contribute them. The threshold moves into the model. Scenarios state their checks the same way; a fitness function is not put between a scenario and its tests.
Translated from Polish.
