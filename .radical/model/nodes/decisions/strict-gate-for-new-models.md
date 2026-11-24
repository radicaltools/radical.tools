---
id: "0e7cbb1d-8c19-4928-a1d7-4fe97c2d6ad3"
type: "adr"
label: "Strict gate for new models"
alternatives: |
  1. Make every rule an error by default: no file needed, but every existing model without check.json would fail CI after an upgrade.
  2. The strict profile with goals at 90% (as IsoStride wrote by hand): fewer blocked first steps, but 10% of requirements could stay unverified for good.
  3. No profile, only documentation: the state that led to this decision.
  4. Baselines set by the first radical check of any kind: a check in CI would write files, and a regression could become a baseline unnoticed.
consequences: |
  • A model made with Radical keeps every promise from its first commit; a gap is an error the day it appears.
  • Existing code adopts the gate without fixing every gap first, and the debt can only shrink.
  • Models made before stay on the defaults until someone writes check.json, so an upgrade breaks no CI.
  • A strict gate makes early modelling slower: a requirement needs its scenario and test before the pull request merges.
  • --adopt is the only way to set baselines up, and only once; it cannot be used to excuse a later regression.
context: "radical setup wrote no check.json, and without one the check runs on its built-in defaults: about ten rules are errors, some thirty-five only warnings, one is off, and no goal is set. A new model made with the radical tools, such as IsoStride's, passed the check with requirements no scenario verified and scenarios no test checked; its author had to write the gate by hand. The defaults are lenient on purpose: an existing model without check.json must not start failing CI when Radical is upgraded."
date: "2026-11-24"
decision: "The defaults stay as they are; the gate a model starts with is written into its check.json when the model is made. radical setup, starting a new model in a repository without code, and Forge, building a model in a folder without check.json, write the strict profile: every rule an error (test-skipped, test-not-run, metric-stale, metric-not-measured and concern-unaddressed included) and every goal at 100%. radical setup in a repository with code, and an Assay run that finishes in a folder without check.json, write the profile for existing code: every rule an error, waiting for its baselines (\"adopt\": true). radical check --adopt takes them once, from the counts and percentages of the first run (a rule's max at its count, a goal's min at its share); until then radical check and the Inspector report one error that says so. From then on --ratchet only lowers them. Whether a repository has code is read from git: tracked files outside .radical/ other than documentation, licences and dot-files."
status: "accepted"
---
