---
id: "1e80f4e3-f53e-4132-8276-13328648155f"
type: "scenario"
label: "A build names its commit"
given: "an app at version 0.3.0 in a git checkout"
tests: |
  packages/node-files/tests/buildInfo.test.ts › names the version, the commit and the day, and a release only on the commit tagged v<version>
  packages/node-files/tests/buildInfo.test.ts › outside git takes the commit from the environment, or has none
  packages/common/tests/version.test.ts › shows a release bare and any other build with its commit
  packages/common/tests/version.test.ts › compares versions by SemVer, two builds of one version from other commits alike
then: "the build shows 0.3.0+<commit>, then 0.3.0, and outside git the commit from RADICAL_COMMIT or GITHUB_SHA, or the bare version without one; two builds of 0.3.0 from other commits compare as the same version"
when: "it is built from an untagged commit, then from the commit tagged v0.3.0 (or a tag push in GitHub Actions), then outside git"
---
