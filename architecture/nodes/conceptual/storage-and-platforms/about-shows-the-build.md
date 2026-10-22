---
id: "8ac06512-d368-463a-bb55-b2beb6af7374"
type: "scenario"
label: "About shows the build"
given: "Studio on the web built from a commit that is not a release"
tests: |
  apps/e2e/tests/studio/about.spec.ts › About Radical Studio › shows the version, commit and day of the build and the folder format, and copies them
  apps/e2e/tests/studio/about.spec.ts › About Radical Studio › the Settings menu fits a low window, so About is reached
  apps/studio/tests/about.test.ts › shows the version, the commit and day of the build, where Studio runs and the folder format
then: "the dialog shows the version with +<commit>, the commit linked to GitHub, the build day, Runs as Browser and Model folder format 1, What's new links to the changelog, and the clipboard holds the same lines under Radical Studio; Esc closes it; in a low window the Settings menu stays in it and About is reached with the mouse"
when: "the user opens Settings on the activity rail, chooses About Radical Studio and presses Copy"
---
