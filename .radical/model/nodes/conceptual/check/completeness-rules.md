---
id: "ff39277b-2b38-473a-8ecc-e9d4944908ba"
type: "requirement"
label: "Completeness rules"
action: "warn about a requirement that misses a field its EARS type needs, that no scenario verifies, that nothing satisfies or that derives from no need or requirement; a need no requirement derives from; a scenario that verifies nothing; an accepted ADR without a fitness function or without its date, context, decision and consequences; an ADR whose superseded status and supersedes links disagree; a fitness function that implements no ADR and constrains nothing; a scenario or fitness function whose metrics name no check; and, as an error, a metrics line that is no condition, a unit that does not convert to its measurement's, or a combine or max_age that cannot be read"
ears_type: "ubiquitous"
rationale: "The trail from need to test that no editor can demand while someone is still writing. A rule finds nothing when the metamodel lacks its types. Evidence: packages/common/src/check/rules.ts (CHECK_RULES: requirement-incomplete, requirement-without-scenario, requirement-unsatisfied, requirement-without-origin, need-without-requirement, scenario-verifies-nothing, adr-without-fitness-fn, adr-incomplete, adr-superseded-unlinked, fitness-fn-unlinked, scenario-without-metrics, fitness-fn-without-metrics, metric-invalid), packages/common/tests/check.test.ts"
---
