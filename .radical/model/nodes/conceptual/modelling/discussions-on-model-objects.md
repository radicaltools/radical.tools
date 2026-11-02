---
id: "599ffb2c-2ee7-4a67-a107-63d8d7fa38f0"
type: "need"
label: "Discussions on model objects"
kind: "stakeholder-note"
source: "User discussion, 2026-10-17; translated from Polish"
---

I want discussions and comments attached to any model object, kept in a separate JSON file and synchronized with the model. A discussion may be local or linked to Confluence, with two-way synchronization when connected. Comments should identify their author: use the signed-in identity where available, or optionally let a local user provide an email address.

**Proposed approach:** Store threads and comments in a dedicated JSON sidecar, referencing model objects by stable IDs and retaining author details, timestamps and external discussion IDs. Synchronize Confluence-linked discussions in both directions using a service account or a connected user's token, such as through Microsoft Entra integration. Keep the comment author's attribution separate from the account used for synchronization; make email attribution optional in local mode.

**First release, 2026-10-25:** Desktop folder models only: Discuss on graph nodes, nested replies, resolve/reopen, optional locally remembered email, and validated atomic writes to discussions.json independent of the model. The original broader need above remains future context, including other object targets, connected identity and two-way Confluence synchronization.

**Browser extension, 2026-10-25:** The user also needs discussions when the web UI connects to a model folder. Reuse the panel and file format through File System Access, preserve permission/reconnect behavior, serialize browser tabs with Web Locks and coordinate their writes with the current desktop app.
