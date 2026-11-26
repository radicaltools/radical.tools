---
id: "2bbc001a-9b51-43af-ab6a-b6d2ff18b256"
type: "need"
label: "A tree checked once"
kind: "stakeholder-note"
source: "Product owner, 2026-11-26"
---

"One more... in IsoStride we changed the model of testing to a pipeline... it is done once, and later at the merge the source is checked, so as not to run it once more needlessly."
Q: IsoStride's model (a tree checked once on the pull request is not checked a second time after the merge): what is to come of it in radical.tools? radical check --from-ci copes with it in the usual case already, as for a commit merged from a pull request it reads the reports of the pull request's run. The CI of radical.tools the same way (the tests and the check run once on the pull request, and a push to main with the same tree, by git's tree hash, does not repeat them, it only builds and deploys; the mark of a checked tree kept in GitHub, a cache or an artifact, without S3; as a pull request of its own), --from-ci by the hash of the tree, the model in the Hub's CI/CD pipeline pack, or nothing for now?
A: The CI of radical.tools the same way.
Translated from Polish.
