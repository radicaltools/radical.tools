---
id: "2ebe793f-dc6a-4394-9e90-38e5811ceb01"
type: "adr"
label: "Goals beside baselines"
alternatives: "Goals only, replacing max: an existing model could no longer adopt a rule at its current count without a percentage that rounds. Baselines only, edited in Studio: no level that keeps its meaning as the model grows. Studio only tightening, as --ratchet does: the product owner wants to loosen a gate deliberately from Studio too, and a hand edit would do it without any warning."
consequences: "A project can hold a level (80 % of requirements verified) that stays meaningful as requirements are added, and still adopt a rule with a baseline. Studio now writes one file beside the model, check.json, and only when Settings are saved; the model files stay untouched. Metrics of the test reports count only with --report, so a goal on them is not checked without one. --ratchet lowers baselines only; goals are raised by hand."
context: "check.json gated a model only by baselines: the most findings a rule may have (requirement-without-scenario max 61). A count says nothing of how much of a growing model is covered, and the product owner wants accepted levels for the model and for what the tests verify, and to set them up in Studio, where the Inspector had only read check.json."
date: "2026-10-16"
decision: "check.json also takes goals: per metric of a catalogue in @radical/common (CHECK_METRICS: the share of elements that meet a rule, or that the tests verify) the least share in percent. A metric below its goal is a finding of the rule goal-unmet, an error by default, so the CLI, CI and Studio fail alike. Baselines stay. The Inspector's Settings edit both and write check.json; they may loosen the gate, but every change that does is marked before saving and the diff of the file is shown."
status: "accepted"
---
