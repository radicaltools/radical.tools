---
id: "8ac06512-d368-463a-bb55-b2beb6af7374"
type: "scenario"
label: "About shows the build"
given: "Studio on the web built from a commit that is not a release"
then: "the dialog shows the version with +<commit>, the commit linked to GitHub, the build day, Runs as Browser and Model folder format 1, What's new links to the changelog, and the clipboard holds the same lines under Radical Studio; Esc closes it; in a low window the Settings menu stays in it and About is reached with the mouse"
when: "the user opens Settings on the activity rail, chooses About Radical Studio and presses Copy"
---
