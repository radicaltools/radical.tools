---
id: "93bd6017-8dda-42b8-aca8-3c25ed385f34"
type: "scenario"
label: "Wiki page deep link"
given: "an element page open in a wiki view"
tests: |
  apps/studio/tests/route.test.ts › route parse/format › omits focus on canvas, includes it on a real view
  apps/studio/tests/route.test.ts › route parse/format › round-trips an fs doc path with slashes
  apps/studio/tests/route.test.ts › route parse/format › parses doc + mode + view + focus
then: "the link holds the document, perspective, view and the element id as focus, and parsing it returns the same page; a canvas route leaves the focus out"
when: "the route is written and read back"
---
