---
id: "23cfabe0-1e49-4887-afc3-50ec7e14b0d9"
type: "scenario"
label: "Status values read"
given: "a TypeScript union of order statuses, code that sets two of them, and an SQL CHECK constraint listing a payment's states"
then: "there is a state fact for each, with its values; the order's lists the lines that set each value, and the payment's names its table and column"
when: "Assay reads the repository"
---
