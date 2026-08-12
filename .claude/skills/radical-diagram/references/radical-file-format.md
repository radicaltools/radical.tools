# .radical file reference

Full schema lives in `src/renderer/src/types/c4.ts` (`DiagramData`) and `src/renderer/src/types/metamodel.ts` (`Metamodel`). This file summarises the optional sections beyond `nodes` + `relations`.

## Top-level shape (`DiagramData`)

```jsonc
{
  "nodes":            [ C4Node, ... ],          // required
  "relations":        [ C4Relation, ... ],      // required
  "sequences":        [ DiagramSequence, ... ], // optional
  "views":            [ DiagramView, ... ],     // optional
  "defaultPositions": { "<nodeId>": { "x", "y", "width", "height" } }, // optional
  "defaultViewport":  { "x": 0, "y": 0, "zoom": 1 },                   // optional
  "snapshots":        [ DiagramSnapshot, ... ], // optional (milestones)
  "presentations":    [ Presentation, ... ],    // optional
  "metamodel":        Metamodel                 // optional — omit for built-in C4
}
```

## Relations

```jsonc
{
  "id": "r1",
  "sourceId": "api",          // initiator
  "targetId": "db",
  "relationType": "interacts",// optional metamodel relation-type id
  "label": "reads/writes",    // optional, short verb phrase
  "technology": "SQL"         // optional
}
```

Built-in C4 relation types: `interacts` (general use; database never a source). The DDD preset adds `realises`, `depends-on`, `partnership`; the governance preset adds `constrains`, `supersedes`, `implements`, `satisfies`, `derives`, `traces-to`. If `relationType` is omitted the default type is assumed.

## Views (filtered perspectives)

A view stores which nodes are visible; relations between visible nodes show automatically.

```jsonc
{
  "id": "v-context",
  "name": "System Context",
  "kind": "static",            // "static" | "dynamic" | "treemap" | "table" | "matrix" | "wiki"
  "nodeIds": ["user", "shop"], // ancestors auto-included
  "positions": {               // per-view node positions (same coordinate rules as nodes)
    "user": { "x": 0, "y": 0, "width": 150, "height": 170 }
  },
  "hiddenRelationIds": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 },   // optional camera state
  "sequenceId": "seq-1"        // only for kind: "dynamic"
}
```

Typical C4 view set for a generated file:
- **System Context** — persons + top-level systems only.
- **Container view** — one system's containers (+ persons/systems that touch them).
- Positions in `positions` may simply copy the node's model positions.

## Sequences (for dynamic views)

Ordered relation ids forming an interaction flow; referenced by a `dynamic` view via `sequenceId`.

```jsonc
{
  "id": "seq-1",
  "name": "Checkout Flow",
  "relationIds": ["r1", "r2", "r5"],
  "stepDescriptions": ["opens cart", null, "persists order"]  // optional, parallel to relationIds
}
```

## Snapshots (milestones) and presentations

Usually leave `"snapshots": []` and a single empty presentation:

```jsonc
"presentations": [ { "id": "<uuid>", "name": "Main", "slides": [] } ]
```

Snapshot shape (only when the user explicitly wants versioned milestones): `{ "id", "name", "timestamp", "nodes": {<id>: C4Node}, "relations": {<id>: C4Relation} }` — note nodes/relations are **records keyed by id**, not arrays.

## DDD / governance element types

Available when using the extended built-in metamodels (the app resolves built-in metamodel ids: `c4-builtin`, `c4-ddd-builtin`, `c4-ddd-governance-builtin`). To use these types, set `"metamodel": { "id": "c4-ddd-governance-builtin" }`-style full metamodel copied from the app, or simply omit the metamodel and stick to core C4 types.

| type        | default w×h | allowed parents         | at root |
|-------------|-------------|-------------------------|---------|
| domain      | 520×360     | domain, group           | yes |
| adr         | 180×52      | system, domain, group   | yes |
| fitness-fn  | 180×52      | system, domain, group   | yes |
| requirement | 200×80      | system, domain, group   | yes |
| blueprint   | 520×360     | domain, group           | yes |
| system (DDD)| 360×260     | system, domain, group   | yes |

## Custom metamodel

Only embed a `metamodel` object when the user needs non-C4 types. Shape per node type (`NodeTypeDef`): `id`, `label`, `color`, `fg`, `iconPath` (16×16 SVG path), `width`, `height`, `collapsedWidth`, `collapsedHeight`, `allowedParents?`, `allowedAtRoot?`, `properties[]`. Relation types (`RelationTypeDef`): `id`, `label`, `allowedPairs: [{from,to}]`, `properties[]`. Copy the structure from `tools/vscode-radical/example/demo.radical` or `src/renderer/src/types/metamodel.ts`.

## Collapsed sizes

If you set `"collapsed": true` on a container, use the collapsed dimensions: person 150×170, system 280×180, container 240×160, component 200×120, database 190×130, webapp 210×140, queue 220×95, domain/group/blueprint 360×220.
