---
id: "5eb58d2d-889a-4a44-9de4-f2a9123fd7c8"
type: "adr"
label: "Model checked in CI"
alternatives: "Keep the model local and run npm run check:architecture by hand: nothing stops drift. Check only the model rules without test reports: a renamed or failing test would go unnoticed. Generate the model from the code: the needs, decisions and their reasons are not in the code."
consequences: "A pull request that breaks a test the model names, or renames one, or adds a requirement without a scenario beyond the baseline, fails CI until the model follows. Model changes show in pull-request diffs again; views.json and snapshots.json are large and diff noisily. Behaviour with no test is described and listed as unverified rather than hidden (61 requirements at the time). The job is not a required check yet; the ruleset can add it."
context: "From 2026-10-13 (#174) architecture/ was kept on the maintainer's machine only, git-ignored, so the model could drift from the code without anyone seeing it. On 2026-10-14 it was rebuilt to describe the current implementation: a domain model, requirements on the components that implement them, every e2e test bound to a scenario, and a code audit that added the behaviour the model lacked. radical check can now tell when it falls behind, and the product owner wants it as a gate in the pipeline."
date: "2026-10-14"
decision: "Commit architecture/ with the code again (only its .radical/ directory stays out of git) and check it in CI: the job \"Architecture model\" runs radical check architecture against the run's test reports (the unit reports of Type-check & Test, and reports/e2e.json unless the e2e suite was skipped) and fails on any error. architecture/check.json holds the rules and baselines: most rules at error with nothing allowed, and baselines (max) for the gaps that are still open, which --ratchet only lowers."
status: "accepted"
---
