---
name: radical-diagram
description: Create or edit .radical diagram files (C4 architecture models for radical.tools) directly as JSON, without using the UI. Use whenever the user wants to create a diagram, architecture model, C4 model, system/container/component view, or a .radical file from a description of a system's structure — even if they don't explicitly mention the .radical format or radical.tools.
---

# Creating .radical diagram files

A `.radical` file is a JSON document (`DiagramData` in `src/renderer/src/types/c4.ts`) that radical.tools opens directly. You can author one by hand from a structure description — no UI needed.

## Workflow

1. Identify the elements (nodes), their containment hierarchy, and the relations between them from the user's description.
2. Pick node types respecting the containment rules below.
3. Compute simple positions (layered top-down layout, see Positioning).
4. Emit the JSON file with a `.radical` extension.
5. Validate: `node .claude/skills/radical-diagram/scripts/validate.mjs <file>`. Fix every reported error before delivering the file.

## Minimal file shape

Only `nodes` and `relations` are required. When `metamodel` is absent the app uses the built-in C4 preset — omit it unless custom types are needed.

```json
{
  "nodes": [
    { "id": "user", "type": "person", "label": "Customer",
      "description": "End user", "x": 0, "y": 0,
      "width": 150, "height": 170, "collapsed": false },
    { "id": "shop", "type": "system", "label": "Shop System",
      "x": -75, "y": 300, "width": 660, "height": 350, "collapsed": false },
    { "id": "api", "type": "container", "label": "API", "technology": "Node.js",
      "parentId": "shop", "x": 30, "y": 120,
      "width": 300, "height": 200, "collapsed": false },
    { "id": "db", "type": "database", "label": "Orders DB", "technology": "PostgreSQL",
      "parentId": "shop", "x": 360, "y": 145,
      "width": 190, "height": 130, "collapsed": false }
  ],
  "relations": [
    { "id": "r1", "sourceId": "user", "targetId": "shop", "label": "uses", "technology": "HTTPS" },
    { "id": "r2", "sourceId": "api", "targetId": "db", "label": "reads/writes", "technology": "SQL" }
  ]
}
```

## Node rules

Required fields: `id`, `type`, `label`, `x`, `y`, `width`, `height`, `collapsed` (use `false`).
Optional: `description`, `technology`, `parentId`, `external` (external actor/system).

- `id`: short, stable, kebab/lowercase (`"payment-api"`). Must be unique across all nodes.
- `label`: 1–4 words; put detail in `description`.
- Relation `id`s must be unique too (`"r1"`, `"r2"`, …).

### Types, default sizes, and containment (built-in C4 metamodel)

| type      | default w×h | allowed parents            | allowed at root |
|-----------|-------------|----------------------------|-----------------|
| person    | 150×170     | group                      | yes |
| system    | 360×260     | system, group              | yes |
| group     | 520×360     | group                      | yes |
| container | 300×200     | system, group              | no  |
| component | 200×120     | container, webapp, group   | no  |
| database  | 190×130     | system, group              | no  |
| webapp    | 210×140     | system, group              | no  |
| queue     | 220×95      | system, group              | no  |

A node with no `parentId` is at root — only `person`, `system`, and `group` may be at root. `container`/`database`/`webapp`/`queue` must have a `system` (or `group`) parent; `component` must sit inside a `container`/`webapp`/`group`.

`webapp` is a built-in node type, and components may use it as a parent. Do not invent custom frontend node types. The current `WebAppNode` keeps its browser-card styling when it has children, unlike the expanded boundary styling used by `container`. When a clear component boundary is required in the current renderer, prefer the built-in `container` type with `technology: "Next.js / React"`; otherwise a `webapp` with component children is schema-valid.

### Relation direction rules

Relations follow "initiator → target". Databases never initiate (`database` must not be a `sourceId`). Persons call `system`/`container`/`webapp`. The validator checks every pair against the active metamodel's allowed relation pairs.

## Positioning

- Children use coordinates **relative to their parent's top-left corner**; root nodes use absolute canvas coordinates.
- Parent containers must be big enough: reserve ~110px at the top for the header, ~20–30px side/bottom padding, and ~30–60px gaps between children. Size the parent to fit (`width ≥ padding + sum(child widths + gaps)`).
- Lay root nodes out top-down by C4 rank: persons at the top, systems below (~80–100px vertical gap between layers, ~60–80px horizontal gap between siblings). Inside a system, place children left-to-right in call order.
- Exact positions are not critical — users can run Smart Layout in the app — but avoid overlapping nodes and children that overflow their parent.

## Optional sections

For views, sequences (dynamic views), presentations, milestones/snapshots, the DDD/governance types (`domain`, `adr`, `fitness-fn`, `requirement`, `blueprint`), and custom metamodels, read [references/radical-file-format.md](references/radical-file-format.md).

The minimal example above is a complete, valid core-C4 model.
