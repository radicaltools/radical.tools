---
id: "48ad1f37-3336-4f91-9ef6-c610ed459636"
type: "requirement"
label: "Wiki follows the view chain"
action: "the wiki view shall write the article the chain gives: the overview lists the first level's elements, each element's page has the elements under it in the chain as its children (named, or as chapters in Multi page, as deep as the multi-page depth allows), the pages tree follows the chain, and the article shows only what the chain gives; without a chain it follows containment as before."
ears_type: "state-driven"
precondition: "a wiki view's filter holds a chain of levels"
rationale: "The chain that shapes the table also writes the document: needs, under each the requirements refined from it, under those the scenarios verifying them — a traceability document straight from the model. An element under several parents is written under each for now. Evidence: packages/ui/src/components/WikiView.tsx (WikiChainContext, chainChildren, shownSet), packages/common/src/viewPipeline.ts (runPipeline), apps/e2e/tests/studio/view-pipeline.spec.ts; manual#view-wiki"
---
