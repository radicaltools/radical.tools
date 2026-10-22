---
id: "7763e7a7-6ec9-4836-abec-c614803e1c5d"
type: "need"
label: "Hub that finds the gaps"
kind: "stakeholder-note"
source: "Product owner, Hub review 2026-10-22"
---

Question (2026-10-22, translated from Polish): the Hub is there and has things in it, but in practice they are useless. What do you think?

Findings agreed in the review: the concepts are generic textbook content that any language model writes in seconds; almost every concept is one element with no relations, so an imported requirement, ADR or fitness function breaks the model's own check rules (no origin, nothing satisfies it, nothing it constrains, no tests); fitness functions are text without anything that runs; blueprints are generic pictures; our own architecture/ model uses no concept from the Hub.

Agreed direction: fewer, deeper packs instead of many single concepts. A pack covers one concern (authentication, idempotency, data retention, ...) as a connected slice that passes radical check once it is bound to an element. The Hub also acts as a critic: from the shape of a model it finds the concerns that apply and that no decision covers, and asks the questions that force the decision, in Studio, over MCP and in CI. First step: one pack (Authentication) end to end and the critic as a check rule.
