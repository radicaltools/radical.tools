---
id: "f795e373-8262-4a69-a2e1-5a7967e77a8a"
type: "scenario"
label: "A checked tree deploys without a second check"
given: "a pull request whose run of ci.yml passed every job and marked its tree, and after its merge a push to main with that tree; and pushes to main whose tree has no mark, whose mark expired, or whose mark a failed run or the run of a fork kept"
then: "for the marked tree it leaves out the E2E suite, the boundary check, the type-check and the unit tests, and builds and deploys; for each of the others it checks the tree whole before it deploys; and a run whose E2E suite was skipped, or that wrote new screenshot baselines, marks nothing"
when: "deploy.yml asks whether the tree was checked"
---
