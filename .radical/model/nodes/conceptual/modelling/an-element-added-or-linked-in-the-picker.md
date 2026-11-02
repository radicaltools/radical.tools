---
id: "346d7532-8f1c-4c65-8534-f5177c52c734"
type: "scenario"
label: "An element added or linked in the picker"
given: "a model with the needs Pay by card and Audit, the requirement Keep an audit trail derived from Audit, and views of the chain needs → requirements as a wiki and as a table"
then: "the picker is headed Add under Pay by card with the chip Requirement, offers Create requirement and Keep an audit trail with its badge; Keep an audit trail derives from Pay by card as well, no new requirement is made, and it shows under both needs; the suggestion links it without a new element and Enter still adds a new one; in the table Enter adds a requirement of that name under the need and the existing one picked is linked; the engine lists the elements of the choice's type that are not the element itself, not linked to it that way yet and pass the level's filters, and none for a choice that goes inside"
when: "the user opens Add or link… on Pay by card in the wiki and picks Keep an audit trail; writes \"audit\" in the Requirements line under another need and picks the suggestion; in the table presses + under a need, writes a name and presses Enter, then again and picks the existing requirement; and the engine lists the candidates for a choice"
---
