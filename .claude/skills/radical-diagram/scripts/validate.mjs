#!/usr/bin/env node
// Validates a .radical file against its active metamodel.
// Usage: node validate.mjs <file.radical>
// Exits 0 when valid, 1 with a list of errors otherwise.
'use strict'

import { readFileSync } from 'fs'

const C4_NODES = {
  person: { parents: ['group'], root: true },
  system: { parents: ['system', 'group'], root: true },
  container: { parents: ['system', 'group'], root: false },
  component: { parents: ['container', 'webapp', 'group'], root: false },
  database: { parents: ['system', 'group'], root: false },
  webapp: { parents: ['system', 'group'], root: false },
  queue: { parents: ['system', 'group'], root: false },
  group: { parents: ['group'], root: true },
}

const C4_PAIRS = [
  ['person', 'system'], ['person', 'container'], ['person', 'webapp'],
  ['system', 'person'], ['system', 'system'], ['system', 'container'], ['system', 'database'], ['system', 'webapp'], ['system', 'queue'],
  ['container', 'person'], ['container', 'system'], ['container', 'container'], ['container', 'database'], ['container', 'webapp'], ['container', 'queue'],
  ['webapp', 'person'], ['webapp', 'system'], ['webapp', 'container'], ['webapp', 'database'], ['webapp', 'webapp'], ['webapp', 'queue'],
  ['queue', 'container'], ['queue', 'webapp'], ['queue', 'component'],
  ['component', 'component'], ['component', 'container'], ['component', 'webapp'], ['component', 'database'], ['component', 'queue'],
]

function builtInPreset(id) {
  const nodeTypes = { ...C4_NODES }
  const pairs = [...C4_PAIRS]
  const relationTypeIds = new Set(['interacts'])
  if (id === 'c4-ddd-builtin' || id === 'c4-ddd-governance-builtin') {
    nodeTypes.system = { parents: ['system', 'domain', 'group'], root: true }
    nodeTypes.domain = { parents: ['domain', 'group'], root: true }
    pairs.push(['system', 'domain'], ['container', 'domain'], ['domain', 'domain'])
    relationTypeIds.add('realises')
    relationTypeIds.add('depends-on')
    relationTypeIds.add('partnership')
  }
  if (id === 'c4-ddd-governance-builtin') {
    nodeTypes.adr = { parents: ['system', 'domain', 'group'], root: true }
    nodeTypes['fitness-fn'] = { parents: ['system', 'domain', 'group'], root: true }
    nodeTypes.requirement = { parents: ['system', 'domain', 'group'], root: true }
    nodeTypes.blueprint = { parents: ['domain', 'group'], root: true }
    const constraintTargets = ['person', 'system', 'domain', 'container', 'component', 'database', 'webapp', 'queue']
    for (const from of ['adr', 'fitness-fn', 'requirement']) for (const to of constraintTargets) pairs.push([from, to])
    for (const to of constraintTargets) pairs.push([to, 'requirement'])
    pairs.push(['adr', 'adr'], ['fitness-fn', 'adr'], ['requirement', 'requirement'], ['requirement', 'adr'], ['requirement', 'fitness-fn'])
    for (const type of ['constrains', 'supersedes', 'implements', 'satisfies', 'derives', 'traces-to']) relationTypeIds.add(type)
  }
  return { nodeTypes, pairs, relationTypeIds, allowAnyPair: false }
}

const PRESET_IDS = new Set(['c4-builtin', 'c4-ddd-builtin', 'c4-ddd-governance-builtin'])
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
if (errors.length) report('unknown')

const metamodel = resolveMetamodel(data.metamodel)
const nodes = data.nodes
const relations = data.relations
const sequences = optionalArray(data.sequences, '"sequences" must be an array when present')
const views = optionalArray(data.views, '"views" must be an array when present')
const byId = new Map()

for (const n of nodes) {
  if (!n.id || typeof n.id !== 'string') { errors.push(`node missing string "id": ${JSON.stringify(n).slice(0, 80)}`); continue }
  if (byId.has(n.id)) errors.push(`duplicate node id "${n.id}"`)
  byId.set(n.id, n)
  if (!n.label || typeof n.label !== 'string') errors.push(`node "${n.id}": missing string "label"`)
  if (!n.type || typeof n.type !== 'string') errors.push(`node "${n.id}": missing string "type"`)
  else if (!metamodel.nodeTypes[n.type]) errors.push(`node "${n.id}": unknown type "${n.type}" for metamodel "${metamodel.name}"`)
  for (const k of ['x', 'y', 'width', 'height']) {
    if (typeof n[k] !== 'number' || !Number.isFinite(n[k])) errors.push(`node "${n.id}": "${k}" must be a finite number`)
  }
  if (typeof n.collapsed !== 'boolean') errors.push(`node "${n.id}": "collapsed" must be a boolean`)
}

for (const n of nodes) {
  if (!n.id || !metamodel.nodeTypes[n.type]) continue
  const type = metamodel.nodeTypes[n.type]
  if (n.parentId != null) {
    const parent = byId.get(n.parentId)
    if (!parent) { errors.push(`node "${n.id}": parentId "${n.parentId}" does not exist`); continue }
    if (n.parentId === n.id) { errors.push(`node "${n.id}": is its own parent`); continue }
    if (!type.parents.includes(parent.type)) errors.push(`node "${n.id}" (${n.type}): parent "${n.parentId}" has type "${parent.type}", allowed parents: ${type.parents.join(', ') || '(none)'}`)
    if ([n.x, n.y, n.width, n.height, parent.width, parent.height].every(Number.isFinite)) {
      if (n.x < 0 || n.y < 0 || n.x + n.width > parent.width || n.y + n.height > parent.height) warnings.push(`node "${n.id}": overflows parent "${n.parentId}" (child ${n.x},${n.y} ${n.width}x${n.height} vs parent ${parent.width}x${parent.height}); enlarge the parent or reposition`)
      if (n.y < 100) warnings.push(`node "${n.id}": y=${n.y} inside parent — leave ~110px for the parent header`)
    }
  } else if (!type.root) {
    errors.push(`node "${n.id}" (${n.type}): not allowed at root — needs a parent (allowed: ${type.parents.join(', ') || '(none)'})`)
  }
}

for (const n of nodes) {
  const seen = new Set()
  let cur = n
  while (cur?.parentId) {
    if (seen.has(cur.id)) { errors.push(`containment cycle involving node "${cur.id}"`); break }
    seen.add(cur.id)
    cur = byId.get(cur.parentId)
  }
}

const relationIds = new Set()
for (const r of relations) {
  if (!r.id || typeof r.id !== 'string') { errors.push(`relation missing string "id": ${JSON.stringify(r).slice(0, 80)}`); continue }
  if (relationIds.has(r.id)) errors.push(`duplicate relation id "${r.id}"`)
  relationIds.add(r.id)
  const src = byId.get(r.sourceId)
  const tgt = byId.get(r.targetId)
  if (!src) errors.push(`relation "${r.id}": sourceId "${r.sourceId}" does not exist`)
  if (!tgt) errors.push(`relation "${r.id}": targetId "${r.targetId}" does not exist`)
  if (r.sourceId === r.targetId) errors.push(`relation "${r.id}": source equals target`)
  if (r.relationType != null && !metamodel.relationTypeIds.has(r.relationType)) errors.push(`relation "${r.id}": unknown relationType "${r.relationType}" for metamodel "${metamodel.name}"`)
  if (src && tgt && !metamodel.allowAnyPair && !metamodel.pairs.some(([from, to]) => src.type === from && tgt.type === to)) {
    errors.push(`relation "${r.id}": ${src.type} → ${tgt.type} is not allowed by metamodel "${metamodel.name}"`)
  }
}

for (const s of sequences) {
  for (const rid of s.relationIds ?? []) {
    if (!relationIds.has(rid)) errors.push(`sequence "${s.id ?? s.name}": relationId "${rid}" does not exist`)
  }
}

for (const v of views) {
  for (const nid of v.nodeIds ?? []) {
    if (!byId.has(nid)) errors.push(`view "${v.id ?? v.name}": nodeId "${nid}" does not exist`)
  }
  if (v.kind === 'dynamic' && v.sequenceId && !sequences.some(s => s.id === v.sequenceId)) errors.push(`view "${v.id ?? v.name}": sequenceId "${v.sequenceId}" does not exist`)
}

report(metamodel.name)

function resolveMetamodel(raw) {
  if (raw == null) return { ...builtInPreset('c4-builtin'), name: 'c4-builtin' }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('"metamodel" must be an object when present')
    return { nodeTypes: {}, pairs: [], relationTypeIds: new Set(), allowAnyPair: false, name: 'invalid' }
  }
  if (PRESET_IDS.has(raw.id)) return { ...builtInPreset(raw.id), name: raw.id }
  if (!raw.id || typeof raw.id !== 'string') errors.push('custom metamodel requires a string "id"')
  if (!raw.name || typeof raw.name !== 'string') errors.push('custom metamodel requires a string "name"')
  if (!raw.nodeTypes || typeof raw.nodeTypes !== 'object' || Array.isArray(raw.nodeTypes)) errors.push('custom metamodel requires an object "nodeTypes"')
  if (!raw.relationTypes || typeof raw.relationTypes !== 'object' || Array.isArray(raw.relationTypes)) errors.push('custom metamodel requires an object "relationTypes"')
  const nodeTypes = {}
  for (const [id, def] of Object.entries(raw.nodeTypes ?? {})) {
    if (!def || typeof def !== 'object') { errors.push(`metamodel node type "${id}" must be an object`); continue }
    if (def.id !== id) errors.push(`metamodel node type "${id}" must have matching id`)
    for (const key of ['label', 'color', 'fg', 'iconPath']) {
      if (!def[key] || typeof def[key] !== 'string') errors.push(`metamodel node type "${id}" requires a string "${key}"`)
    }
    for (const key of ['width', 'height']) {
      if (typeof def[key] !== 'number' || !Number.isFinite(def[key]) || def[key] <= 0) errors.push(`metamodel node type "${id}" requires a positive finite "${key}"`)
    }
    const parents = Array.isArray(def.allowedParents) ? def.allowedParents : []
    if (!parents.every(p => typeof p === 'string')) errors.push(`metamodel node type "${id}": "allowedParents" must contain strings`)
    if (def.allowedAtRoot != null && typeof def.allowedAtRoot !== 'boolean') errors.push(`metamodel node type "${id}": "allowedAtRoot" must be a boolean`)
    if (def.properties != null && !Array.isArray(def.properties)) errors.push(`metamodel node type "${id}": "properties" must be an array`)
    nodeTypes[id] = { parents, root: def.allowedAtRoot ?? parents.length === 0 }
  }
  const pairs = []
  const relationTypeIds = new Set()
  let allowAnyPair = false
  for (const [id, def] of Object.entries(raw.relationTypes ?? {})) {
    if (!def || typeof def !== 'object') { errors.push(`metamodel relation type "${id}" must be an object`); continue }
    if (def.id !== id) errors.push(`metamodel relation type "${id}" must have matching id`)
    if (!def.label || typeof def.label !== 'string') errors.push(`metamodel relation type "${id}" requires a string "label"`)
    relationTypeIds.add(id)
    if (!Array.isArray(def.allowedPairs)) { errors.push(`metamodel relation type "${id}" requires an "allowedPairs" array`); continue }
    if (def.allowedPairs.length === 0) allowAnyPair = true
    for (const pair of def.allowedPairs) {
      if (!pair || typeof pair.from !== 'string' || typeof pair.to !== 'string') errors.push(`metamodel relation type "${id}": every allowed pair needs string "from" and "to"`)
      else pairs.push([pair.from, pair.to])
    }
  }
  return { nodeTypes, pairs, relationTypeIds, allowAnyPair, name: raw.id ?? 'custom' }
}

function optionalArray(value, error) {
  if (value == null) return []
  if (Array.isArray(value)) return value
  errors.push(error)
  return []
}

function report(metamodelName) {
  for (const warning of warnings) console.warn(`WARN:  ${warning}`)
  for (const error of errors) console.error(`ERROR: ${error}`)
  if (errors.length) {
    console.error(`\n${errors.length} error(s), ${warnings.length} warning(s) in ${file}`)
    process.exit(1)
  }
  console.log(`OK: ${file} is valid for ${metamodelName} (${warnings.length} warning(s))`)
}
