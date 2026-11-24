---
id: "2334a12e-58a9-4d71-8d90-3c73040f3976"
type: "requirement"
label: "GitHub Actions sensor"
action: "it shall read through the GitHub CLI (`gh`) the repository's workflow runs of the given days and the rules of its main branch, and measure, with no labels, ci.pr.duration.p50 and ci.pr.duration.p90 (the wall time of one pull-request commit's runs taken together), ci.main.success.rate (the share of commits on the main branch whose runs all succeeded), ci.rerun.rate (the share of runs run again) and the main branch's ci.required-checks and ci.required-reviews, judging no value"
ears_type: "event-driven"
rationale: "A pipeline's speed and reliability and the main branch's protection are facts GitHub keeps; read as measurements, the CI/CD pipeline pack's conditions judge them. The metrics carry no labels, so a pack's condition, which cannot know the project's workflow names, matches them. ADR Sensors measure, the model decides."
trigger: "the github-actions sensor runs"
---
