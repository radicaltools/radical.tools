---
id: "36098751-ed0a-438e-a057-06b28efabc04"
type: "scenario"
label: "Draw missing wireframes"
gherkin: "# Not covered by an automated test"
given: "the Mockups stage created five mockups without wireframes"
then: "Forge draws them one after another showing \"Drawing n/5\", stores each wireframe on its mockup, and reports any that failed"
when: "the user presses ✨ Generate 5 wireframes"
---
