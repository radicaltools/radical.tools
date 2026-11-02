---
id: "396f467a-1f79-4ee1-bbc9-f766442df00a"
type: "requirement"
label: "Offered links are accepted"
action: "Studio shall offer as a link to make (Add or link… in the table and the wiki, the wiki's other relationships, the wizard's relation steps, the connect key, the relation type selects, the matrix and moving a relation's end) only an element and a relation type the model then accepts: never what holds the element through a structural type, an aggregate root as part of another or a part of a second aggregate; keep what is linked already in a wizard's step; drop from an open list an element an outside edit removed; and say an element was linked only when the relation was made."
ears_type: "ubiquitous"
rationale: "Each picker had a rule of its own, and listed what the model then refused or Validation then flagged: Add or link and the ADR wizard offered the element's own system, the table then saying it was linked (F-0033); Add or link offered an aggregate root as part of another (F-0044); a picker opened before an outside edit kept the removed element and linked to it (F-0045). Exploratory runs 177 and 181, round 177–184, 2026-10-23. One check, relationRefusal, now decides both what is offered and what is accepted. Evidence: packages/common/src/relationRules.ts (relationTypesAccepted, linkRefusal, wizardLinkCandidates); packages/common/src/viewPipeline.ts (linkCandidates, connectTypes); packages/ui/src/components/TableView.tsx (linkExisting); packages/ui/src/components/WikiView.tsx (linkExisting)"
---
