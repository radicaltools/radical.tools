---
id: "404fb5ed-3045-4950-bbc0-6c3fd90768fb"
type: "scenario"
label: "Stale deep link degrades"
gherkin: "# Not covered by an automated test (apps/studio/tests/route.test.ts covers parsing only)"
given: "a link #/m/viewer/v/<id> whose view does not exist in the open model"
then: "Studio skips the Welcome screen, switches to Viewer and shows the default Structure view"
when: "the user opens the link"
---
