---
id: "7c6f76e9-a041-48b9-8b14-573db32bbff1"
type: "adr"
label: "Inherited decisions bind unless waived"
alternatives: "Only standards the model links with constrains bind (the gap stays: an unlinked standard is silent). A list of waived standards in check.json (the exception lives outside the model). An ADR that supersedes the inherited one (mixes 'replaced everywhere' with 'does not apply here'). Warnings by default (a group standard is binding; the gap would go unnoticed)."
consequences: "A system that starts depending on a standards model fails its check until it has gone through every standard once. Waivers are decisions with context and consequences, visible in Studio and in the model's diff. A waiver ADR needs no fitness function of its own. Projects that cannot meet this at once lower the two rules to warnings in check.json."
context: "A group keeps its technical standards as ADRs in a model its systems depend on (deps.json). radical check leaves out what it finds about another model's elements, so a fetched ADR that constrains none of the system's elements, or one no fitness function checks, passes unnoticed: in the benchmark an agent read the standard, built part of it, and the check was green."
date: "2026-11-12"
decision: "Every accepted ADR fetched from a model this one depends on binds this model. Either the model applies it, linking it with constrains to the elements it governs, each of which then needs a fitness function (the model's own or fetched) that implements the ADR and names its check; or an accepted ADR of the model waives it (a new relation, waives, from the model's ADR to the inherited one) and says why. radical check reports a standard neither applied nor waived (inherited-adr-unapplied) and an applied one without a check (inherited-adr-unchecked) as errors."
status: "accepted"
---
