---
id: "1a5d8e73-5188-432a-9e36-884f71e6134b"
type: "scenario"
label: "A review passes a manual function"
given: "a manual fitness function with the condition review(Security review) passed and max_age 90d"
metrics: |
  test(apps/cli/src/sense.test.ts › radical sense › records a review in reviews.json beside the model, kept in git) passed
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › evaluates a review condition against the latest review of the fitness function) passed
then: "reviews.json holds both with who and when, the condition follows the latest (passed, then failed), and a review older than max_age reads stale"
when: "a person records a passed review, then a failed one, and later the passed one is older than 90 days"
---
