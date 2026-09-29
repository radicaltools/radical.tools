// ─── Metamodel package ───────────────────────────────────────────────────
//
// Barrel re-exporting the split-out pieces so existing `from '../types/metamodel'`
// imports keep working:
//   • types.ts    — the generic Metamodel/NodeTypeDef/RelationTypeDef shapes
//   • lookup.ts   — allowed-parent / allowed-relation / cardinality helpers
//   • validate.ts — validateModel + Issue
//   • ears.ts     — EARS sentence compose/parse for the Requirement node type
//   • presets/    — the built-in C4, C4+DDD, and C4+DDD+Governance presets

export * from './types'
export * from './lookup'
export * from './validate'
export * from './ears'
export * from './presets'
