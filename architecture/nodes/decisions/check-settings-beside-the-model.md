---
id: "104ee5e2-1445-4096-931b-026060b5074f"
type: "adr"
label: "Check settings beside the model"
alternatives: "check.json inside the document (DiagramData): every store path (undo, save, export, reset) would carry it, for no gain while only the CLI writes it. Studio reading the CLI's evidence file: stale after the first edit. Studio running the tests: it has no test runner and the tests are the project's."
consequences: "Studio, the CLI and CI check alike. Studio only reads check.json; --ratchet writes it. Models kept in a single file or in browser storage have no test results; the Inspector checks the model rules for them. check.json is no part of DiagramData, so a model exported to a .radical file leaves it behind."
context: "The CLI read its rule settings from radical-check.json in the working directory, which Studio cannot see, so Studio and CI could disagree about severities and baselines. Studio also needs what the tests say, and evidence worked out by the CLI goes stale as soon as the model is edited (a test added to a scenario, a verifies relation removed)."
date: "2026-10-14"
decision: "The rule settings are check.json in the model folder: a plain file beside the model's sidecars, in git with the model, read by the CLI by default (--config names another) and by Studio. With --report the CLI keeps the test cases it read in the folder's .radical/test-results.json, out of git like the rest of .radical/. Studio polls both files for the open folder model, as it polls the Forge run status, and runs checkModel from @radical/common on the model as it is, so the evidence always matches the current model."
status: "accepted"
---
