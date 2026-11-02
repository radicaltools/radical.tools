---
id: "3fa03aba-a084-495b-9eea-30f079c42a24"
type: "step"
label: "A git hook runs"
children: "sequence"
condition: "if a checkout, a commit, a pull or merge, or a rebase"
order: 1
repeat: "1"
---

post-checkout, post-commit, post-merge or post-rewrite, installed once with radical hooks install (npm run hooks here).
