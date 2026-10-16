---
id: "0d9929de-c192-4554-8655-dd0a281cbcef"
type: "scenario"
label: "Search opens collapsed container"
given: "Orders DB inside Bookstore, which is collapsed in the Containers view, or folded in the model and open in the view"
tests: |
  apps/e2e/tests/studio/physics.spec.ts › Quick Search shows what it finds › a container folded in the model and open in the view stays open
  apps/e2e/tests/studio/physics.spec.ts › Quick Search shows what it finds › a container collapsed in the view is opened
then: "Orders DB is shown, and the view keeps Bookstore open"
when: "the user searches for Orders DB in Quick Search and presses Enter"
---
