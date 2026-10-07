---
id: "65bcdbf7-5067-4f72-9527-af1e7ede68a8"
type: "adr"
label: "Graph views use Smart Layout"
alternatives: "A hand-tuned ELK configuration per view."
consequences: "Layout improvements reach every view. Changes to layout code are measured before and after with the composite score over several fixtures and runs."
context: "Smart Layout is the product's core IP. Parallel layout code in new views gives worse results and splits the effort."
date: "2026-10-06"
decision: "New graph-like views feed @radical/layout's Smart Layout, followed by the live WebCoLa physics pass the canvas uses, instead of calling ELK directly. Smart Layout's positions are not post-processed, except to keep the user's layout constraints (ADR \"User alignments bind layout\")."
status: "accepted"
---
