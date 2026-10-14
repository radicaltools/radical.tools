---
id: "d3ee2fc1-24f6-4646-af5f-7b98157ce4aa"
type: "component"
label: "@radical/layout"
technology: "TypeScript, ELK.js, WebCoLa"
---

packages/layout: Smart Layout and the other headless layout engines, used by Studio and bundled into the MCP server. smartLayout.ts: the ensemble of ten engines (elkLayout.ts: five ELK layered variants, a metamodel-aware layered layout, stress, force, Mr.Tree; radicalLayout.ts: semantic C4), crossing minimisation by sibling swaps (crossingOpt.ts), the render-aware composite score (weights in scoreWeights.ts), simulated annealing in three phases (annealing.ts), finalisation that separates siblings and fits containers (layoutFinalize.ts) with room for relation labels (labelRoom.ts), and the relaxed winner as a last candidate. elkLayout.ts also has the hierarchical tree layout (applyTreeLayout). constraints.ts resolves and enforces row, column and grid alignments; viewInput.ts gives what a layout of one view sees and writes its result back (shared by Studio's store and the MCP server); geometry.ts places new and imported elements (placeNewNode, freeSpotNear, createBatchPlacer, placeUnplaced). For the canvas: edgeRouting.ts (Bezier edges, A* routing around elements), portAllocator.ts (sides and spread connection points) and edgeLabels.ts (label sizes and placement). liveColaEngine.ts: the live WebCoLa physics (LiveColaEngine, which the canvas runs in a worker; calm and push drags, pins, alignments, holdByGroups) and relaxLayout, which Smart Layout scores as a candidate. The product's core IP.
