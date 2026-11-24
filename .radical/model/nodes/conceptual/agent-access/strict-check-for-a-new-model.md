---
id: "9cf4dc15-4d62-46f1-8ccd-19019ad0af3c"
type: "requirement"
label: "Strict check for a new model"
action: "it shall write a check.json that sets every rule to error, test-skipped, test-not-run, metric-stale, metric-not-measured and concern-unaddressed included, and every goal to a minimum of 100%"
ears_type: "event-driven"
rationale: "A model that starts with the code can keep every promise from the first commit; the built-in defaults, mostly warnings and no goals, let a new model pass with no scenario tested. ADR Strict gate for new models."
trigger: "radical setup starts a new model in a repository without code, or Forge builds a model in a folder without check.json"
---
