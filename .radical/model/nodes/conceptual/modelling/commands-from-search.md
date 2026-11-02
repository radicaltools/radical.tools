---
id: "bc7bdf43-ad49-4609-8985-c7f3394aa908"
type: "scenario"
label: "Commands from search"
given: "a model open in Designer"
metrics: "test(apps/e2e/tests/studio/search.spec.ts › > lists the commands and runs the one picked) passed"
then: "the Viewer perspective opens; the theme command switches the theme; Designer-only commands are not listed in Viewer"
when: "the user types >viewer, and later >theme, and picks the command"
---
