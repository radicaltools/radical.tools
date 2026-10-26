---
id: "4ae055f8-51cd-4baa-ada6-535303ae060b"
type: "scenario"
label: "A route wherever the grid falls"
given: "the sample's Core Banking view: a relation from API Gateway to Accounts Service across Payments Service and its components, with a far element setting the routing grid's origin"
tests: "packages/layout/tests/edgeRouting.test.ts › routes around nodes › finds the route wherever the grid falls: the keep-outs behind the ends never wall in their exits"
then: "a route is found on every origin, and it passes through no element between the ends"
when: "the relation is routed on each grid origin"
---
