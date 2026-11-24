---
id: "77d7edd0-9856-4c59-acc0-2af80cfdc16e"
type: "scenario"
label: "Regression refused"
given: "a main page whose LCP on main is a steady 3800 ms"
then: "the LCP condition fails against the main branch's median plus 10%"
when: "a pull request makes it 25% slower"
---
