---
id: "3c7aa05f-f995-4e41-b8ff-5449129f71af"
type: "fitness-fn"
label: "Assay domain and lifecycle tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/assay/tests/domain.test.ts (tables with their columns and foreign keys from SQL and ORM classes, status values and the lines that set them, entry points), packages/assay/tests/skeleton.test.ts (pending tests for each framework) and apps/mcp/src/assayDomain.test.ts (entities, processes and state machines written from a plan, refused without their evidence, and the pending test of a scenario drawn from the code).
