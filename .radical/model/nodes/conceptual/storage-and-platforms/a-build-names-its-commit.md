---
id: "1e80f4e3-f53e-4132-8276-13328648155f"
type: "scenario"
label: "A build names its commit"
given: "an app at version 0.3.0 in a git checkout"
then: "the build shows 0.3.0+<commit>, then 0.3.0, and outside git the commit from RADICAL_COMMIT or GITHUB_SHA, or the bare version without one; two builds of 0.3.0 from other commits compare as the same version"
when: "it is built from an untagged commit, then from the commit tagged v0.3.0 (or a tag push in GitHub Actions), then outside git"
---
