---
id: "4a1d36e1-c506-4875-9a26-03a9bf2f0e84"
type: "scenario"
label: "Release 0.3.0"
given: "the four packages at 0.2.0 and a changelog with Unreleased entries"
metrics: |
  test(tools/release.test.mjs › sets the next version: major, minor, patch or one given that is newer) passed
  test(tools/release.test.mjs › moves the Unreleased entries under the version and its date, and links them) passed
  test(tools/release.test.mjs › changes only the version of a package.json) passed
  test(tools/release.test.mjs › sets the released workspaces in the lockfile, nothing else) passed
  test(tools/release.test.mjs › refuses to tag when a package carries another version or the changelog has no section for it) passed
then: "the four package.json files and the lockfile carry 0.3.0 and nothing else changes in them, the entries move under ## [0.3.0] with the date and its compare link, an empty Unreleased stays above; tagging is refused while a package carries another version or the changelog has no 0.3.0 section, and an empty Unreleased or an older version is refused"
when: "the maintainer runs npm run release -- minor, merges it, and runs npm run release:tag"
---
