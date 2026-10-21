---
id: "5b005471-9b7e-48d7-a96a-619e02628942"
type: "requirement"
label: "Rule settings per project"
action: "read the project's rule settings from check.json in the model folder, or from the file --config names, also when saved with a byte-order mark, and let each rule, or one kind of metamodel issue as metamodel/<code>, be set to error, warning or off, with a max baseline up to which its findings pass as warnings, naming every config key that matches no rule"
ears_type: "ubiquitous"
rationale: "The same settings serve the CLI, CI and Studio's Inspector, and let an existing model adopt a rule before every gap is closed. Evidence: apps/cli/src/check.ts (configPath), packages/common/src/check/index.ts (RuleSetting, settle, unknownRules), packages/common/src/check/files.ts (CHECK_CONFIG_FILE, parseCheckConfig)"
---
