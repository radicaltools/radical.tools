---
id: "93f9a8e1-9e36-4958-b607-2962c397efa2"
type: "requirement"
label: "Broken relations refused"
action: "Studio and the MCP server shall refuse it with a message giving the reason, and add or change nothing."
ears_type: "unwanted-behaviour"
rationale: "Validation flags both, so making them only made the model invalid: Add or link made an aggregate root part of another (F-0044), and a picker opened before an outside edit linked to the element it had removed, leaving a relation to nothing (F-0045); round 177–184, 2026-10-23. Evidence: packages/common/src/relationRules.ts (relationRefusal, aggregateRefusal); packages/common/src/metamodel/domainModel.ts (validateDomainModel)"
unwanted_condition: "a new relation, or a relation whose end is moved, would be a part-of that breaks the aggregate rules (an aggregate root part of another, a part of an entity that is no aggregate root, a part of a second aggregate), or would have an end that is no element of the model (deleted meanwhile)"
---
