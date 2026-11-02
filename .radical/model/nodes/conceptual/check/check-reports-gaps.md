---
id: "9145659b-05ac-495e-ade2-a565eeaaaf50"
type: "requirement"
label: "Check reports gaps"
action: "report each file problem, metamodel issue and completeness gap with the rule, its severity and the file it is in, without writing the model"
ears_type: "event-driven"
rationale: "One list a pipeline, a person and an agent read alike. Evidence: packages/common/src/check; apps/cli/src/check.ts"
trigger: "`radical check` runs on a Markdown model folder"
---
