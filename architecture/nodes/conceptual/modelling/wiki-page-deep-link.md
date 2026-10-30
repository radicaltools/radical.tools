---
id: "93bd6017-8dda-42b8-aca8-3c25ed385f34"
type: "scenario"
label: "Wiki page deep link"
given: "an element page open in a wiki view"
metrics: |
  test(apps/studio/tests/route.test.ts › route parse/format › omits focus on All elements, includes it on a real view) passed
  test(apps/studio/tests/route.test.ts › route parse/format › round-trips an fs doc path with slashes) passed
  test(apps/studio/tests/route.test.ts › route parse/format › parses doc + mode + view + focus) passed
then: "the link holds the document, perspective, view and the element id as focus, and parsing it returns the same page; a route to All elements leaves the focus out"
when: "the route is written and read back"
---
