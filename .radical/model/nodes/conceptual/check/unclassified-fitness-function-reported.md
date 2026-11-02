---
id: "5525110f-8857-4fa0-b15d-80b482cb1f2a"
type: "requirement"
label: "Unclassified fitness function reported"
action: "it shall report fitness-fn-unclassified, a warning that names the dimensions the function lacks."
ears_type: "event-driven"
rationale: "What the classification of an older model could not tell is asked for, not guessed. Evidence: packages/common/src/check/rules.ts"
trigger: "radical check reads a fitness function without a characteristic, a scope, a cadence or an invocation"
---
