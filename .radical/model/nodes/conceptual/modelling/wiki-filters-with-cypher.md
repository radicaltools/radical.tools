---
id: "0eab32ac-3cb1-433f-8cbf-5719c014b883"
type: "need"
label: "Wiki filters with Cypher"
kind: "stakeholder-note"
source: "User discussion, 2026-10-17"
---

I want to express graph-based wiki filters with Cypher queries, so I can select pages by their properties and relationships and reuse the query in other views.

**Proposed approach:** Add an optional saved, read-only Cypher query with parameters to a view's filter. Validate its type and property references against the active metamodel, use its results to select pages, and retain the existing pipeline for chapter structure. Allow the query to be reused through metamodel viewpoints.
