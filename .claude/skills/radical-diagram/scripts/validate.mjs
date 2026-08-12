#!/usr/bin/env node
// Validates a .radical file against the built-in C4 metamodel rules.
// Usage: node validate.mjs <file.radical>
// Exits 0 when valid, 1 with a list of errors otherwise.
'use strict'

import { readFileSync } from 'fs'

const ALLOWED_PARENTS = {
  person:        ['group'],
  system:        ['system', 'group', 'domain'],
  container:     ['system', 'group'],
  component:     ['container', 'webapp', 'group'],
  database:      ['system', 'group'],
  webapp:        ['system', 'group'],
  queue:         ['system', 'group'],
  group:         ['group'],
  domain:        ['domain', 'group'],
  adr:           ['system', 'domain', 'group'],
  'fitness-fn':  ['system', 'domain', 'group'],
  requirement:   ['system', 'domain', 'group'],
  blueprint:     ['domain', 'group'],
}
const ROOT_OK = new Set(['person', 'system', 'group', 'domain', 'adr', 'fitness-fn', 'requirement', 'blueprint'])
const CONTAINER_TYPES = new Set(['system', 'container', 'domain', 'group', 'blueprint'])
const KNOWN_TYPES = new Set(Object.keys(ALLOWED_PARENTS))

const file = process.argv[2]
if (!file) {
  console.error('Usage: node validate.mjs <file.radical>')
  process.exit(1)
}

const errors = []
const warnings = []

let data
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`ERROR: not valid JSON: ${e.message}`)
  process.exit(1)
}

if (!Array.isArray(data.nodes)) errors.push('"nodes" must be an array')
if (!Array.isArray(data.relations)) errors.push('"relations" must be an array')
if (errors.length) { report(); }

const nodes = data.nodes ?? []
const relations = data.relations ?? []
const customTypes = data.metamodel?.nodeTypes ? new Set(Object.keys(data.metamodel.nodeTypes)) : null

const byId = new Map()
for (const n of nodes) {
  if (!n.id || typeof n.id !== 'string') { errors.push(`node missing string "id": ${JSON.stringify(n).slice(0, 80)}`); continue }
  if (byId.has(n.id)) errors.push(`duplicate node id "${n.id}"`)
  byId.set(n.id, n)
  if (!n.label) errors.push(`node "${n.id}": missing "label"`)
  if (!n.type) errors.push(`node "${n.id}": missing "type"`)
  else if (customTypes ? !customTypes.has(n.type) : !KNOWN_TYPES.has(n.type)) {
    errors.push(`node "${n.id}": unknown type "${n.type}"`)
  }
  for (const k of ['x', 'y', 'width', 'height']) {
    if (typeof n[k] !== 'number' || !Number.isFinite(n[k])) errors.push(`node "${n.id}": "${k}" must be a finite number`)
  }
  if (typeof n.collapsed !== 'boolean') warnings.push(`node "${n.id}": "collapsed" should be a boolean (use false)`)
}

for (const n of nodes) {
  if (!n.id) continue
  if (n.parentId != null) {
    const parent = byId.get(n.parentId)
    if (!parent) { errors.push(`node "${n.id}": parentId "${n.parentId}" does not exist`); continue }
    if (n.parentId === n.id) { errors.push(`node "${n.id}": is its own parent`); continue }
    if (!customTypes) {
      const allowed = ALLOWED_PARENTS[n.type] ?? []
      if (parent.type && !allowed.includes(parent.type)) {
        errors.push(`node "${n.id}" (${n.type}): parent "${n.parentId}" has type "${parent.type}", allowed parents: ${allowed.join(', ') || '(none)'}`)
      }
    }
    if (parent.type && !CONTAINER_TYPES.has(parent.type)) {
      errors.push(`node "${n.id}": parent "${n.parentId}" (${parent.type}) is not a container type`)
    }
    // Child geometry is relative to parent — check it fits.
    if ([n.x, n.y, n.width, n.height, parent.width, parent.height].every(Number.isFinite)) {
      if (n.x < 0 || n.y < 0 || n.x + n.width > parent.width || n.y + n.height > parent.height) {
        warnings.push(`node "${n.id}": overflows parent "${n.parentId}" (child ${n.x},${n.y} ${n.width}x${n.height} vs parent ${parent.width}x${parent.height}); enlarge the parent or reposition`)
      }
      if (n.y < 100) warnings.push(`node "${n.id}": y=${n.y} inside parent — leave ~110px for the parent header`)
    }
  } else if (!customTypes && n.type && !ROOT_OK.has(n.type)) {
    errors.push(`node "${n.id}" (${n.type}): not allowed at root — needs a parent (allowed: ${(ALLOWED_PARENTS[n.type] ?? []).join(', ')})`)
  }
}

// Cycle check on parentId chain.
for (const n of nodes) {
  const seen = new Set()
  let cur = n
  while (cur?.parentId) {
    if (seen.has(cur.id)) { errors.push(`containment cycle involving node "${cur.id}"`); break }
    seen.add(cur.id)
    cur = byId.get(cur.parentId)
  }
}

const relIds = new Set()
for (const r of relations) {
  if (!r.id) { errors.push(`relation missing "id": ${JSON.stringify(r).slice(0, 80)}`); continue }
  if (relIds.has(r.id)) errors.push(`duplicate relation id "${r.id}"`)
  relIds.add(r.id)
  const src = byId.get(r.sourceId)
  const tgt = byId.get(r.targetId)
  if (!src) errors.push(`relation "${r.id}": sourceId "${r.sourceId}" does not exist`)
  if (!tgt) errors.push(`relation "${r.id}": targetId "${r.targetId}" does not exist`)
  if (r.sourceId === r.targetId) errors.push(`relation "${r.id}": source equals target`)
  if (!customTypes && src?.type === 'database') {
    errors.push(`relation "${r.id}": database "${r.sourceId}" cannot initiate a relation (swap source/target)`)
  }
}

for (const s of data.sequences ?? []) {
  for (const rid of s.relationIds ?? []) {
    if (!relIds.has(rid)) errors.push(`sequence "${s.id ?? s.name}": relationId "${rid}" does not exist`)
  }
}

for (const v of data.views ?? []) {
  for (const nid of v.nodeIds ?? []) {
    if (!byId.has(nid)) errors.push(`view "${v.id ?? v.name}": nodeId "${nid}" does not exist`)
  }
  if (v.kind === 'dynamic' && v.sequenceId && !(data.sequences ?? []).some((s) => s.id === v.sequenceId)) {
    errors.push(`view "${v.id ?? v.name}": sequenceId "${v.sequenceId}" does not exist`)
  }
}

report()

function report() {
  for (const w of warnings) console.warn(`WARN:  ${w}`)
  for (const e of errors) console.error(`ERROR: ${e}`)
  if (errors.length) {
    console.error(`\n${errors.length} error(s), ${warnings.length} warning(s) in ${file}`)
    process.exit(1)
  }
  console.log(`OK: ${file} is a valid .radical file (${warnings.length} warning(s))`)
  process.exit(0)
}
