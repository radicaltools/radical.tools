---
id: "7d194b7a-6ee3-4361-963c-89de87743097"
type: "fitness-fn"
label: "Check profile tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/checkProfiles.test.ts checks the strict profile (every rule an error, every goal 100%), the profile for existing code and adoptBaselines; apps/cli/src/adopt.test.ts runs radical check --adopt on a model of existing code (an error until the baselines are taken, taken once, refused the second time); apps/cli/src/setup.test.ts checks that radical setup writes the strict profile in a repository without code, the one for existing code in a repository with code, and leaves a check.json that is there.
