---
id: "c1afa581-efb3-4ff2-92fa-d60e979d4085"
type: "requirement"
label: "Reports keep why a test failed"
action: "the report reader shall keep with each test case the failure message (without terminal colour codes, cut to a few lines), its duration in milliseconds and its line in the file, each where the report holds it"
ears_type: "event-driven"
rationale: "Before, a test case kept only its file, title and status, so the Inspector could say that a test failed but not why. The test runner already wrote the reason into the report."
trigger: "radical check reads a Vitest or Jest JSON, Playwright JSON or JUnit XML report"
---
