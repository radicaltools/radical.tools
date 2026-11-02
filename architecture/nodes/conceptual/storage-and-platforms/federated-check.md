---
id: "27a0f3c8-055a-4a39-9040-656a0d192177"
type: "requirement"
label: "Federated check"
action: "the CLI shall check the model composed with its pinned dependencies, so that a relation to an element of a dependency passes and one to an element no model has is an error, leave out what it finds about the dependencies' own elements and relations and their share of the metrics, and name the dependencies and commits it checked against"
ears_type: "event-driven"
rationale: "Checked alone, a model's references to other models would each be rel-end-missing; checked with them, a reference to an element that is gone is caught. What is wrong in another model is that model's to fix. --alone checks the folder without them. Evidence: apps/cli/src/check.ts, apps/cli/src/federation.ts (composeFolder, federationOthers), packages/common/src/check/index.ts (CheckOptions.others; findings about elements with an origin left out)"
trigger: "radical check runs on a model folder with deps.json"
---
