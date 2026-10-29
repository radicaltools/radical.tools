// ─── Hub visual tokens ───────────────────────────────────────────────────────
//
// Single source of truth for how Hub concepts look — in the standalone hub
// site, the in-app import modal and (via the node-type tokens) the studio
// canvas. A hub *category* is mapped onto the C4 node type it produces, so a
// Requirement card carries the same colour / icon / label as a Requirement
// node on the canvas.

import type { C4ElementType } from '@radical/common/c4'
import { NODE_COLORS, NODE_FG, TYPE_LABELS, TYPE_ICON_PATHS } from '@radical/common/c4'
import type { HubCategory } from '@radical/common/hubFormat'
import { CONCERN_GROUPS } from '@radical/common/concerns'

export type { HubCategory }


/** The categories the Hub lists: it holds only concern packs. The others
 *  remain for concept files saved from the Hub before. */
export const HUB_CATEGORIES: readonly HubCategory[] = ['concern']

export interface VisualToken {
  label: string
  /** Plural form for filter chips / tabs. */
  plural: string
  color: string
  fg: string
  /** SVG path data (16×16 viewBox). */
  iconPath: string
}

/** Node type a hub category materialises as. `pattern` is a bundle of plain
 *  C4 elements and has no dedicated type, so it borrows the System tokens. */
export const CATEGORY_NODE_TYPE: Record<HubCategory, C4ElementType> = {
  // A concern pack settles a decision: it looks like its ADR.
  concern: 'adr',
  pattern: 'system',
  'fitness-function': 'fitness-fn',
  requirement: 'requirement',
  adr: 'adr',
  blueprint: 'blueprint',
}

const CATEGORY_LABELS: Record<HubCategory, { label: string; plural: string }> = {
  concern: { label: 'Concern pack', plural: 'Concern packs' },
  pattern: { label: 'Pattern', plural: 'Patterns' },
  'fitness-function': { label: 'Fitness Function', plural: 'Fitness Functions' },
  requirement: { label: 'Requirement', plural: 'Requirements' },
  adr: { label: 'ADR', plural: 'ADRs' },
  blueprint: { label: 'Blueprint', plural: 'Blueprints' },
}

export const CATEGORY_THEME: Record<HubCategory, VisualToken> = Object.fromEntries(
  HUB_CATEGORIES.map((cat) => {
    const type = CATEGORY_NODE_TYPE[cat]
    return [cat, {
      ...CATEGORY_LABELS[cat],
      color: NODE_COLORS[type],
      fg: NODE_FG[type],
      iconPath: TYPE_ICON_PATHS[type],
    }]
  }),
) as Record<HubCategory, VisualToken>

export const NODE_TYPE_THEME: Record<C4ElementType, VisualToken> = Object.fromEntries(
  (Object.keys(NODE_COLORS) as C4ElementType[]).map((type) => [type, {
    label: TYPE_LABELS[type],
    plural: TYPE_LABELS[type] + 's',
    color: NODE_COLORS[type],
    fg: NODE_FG[type],
    iconPath: TYPE_ICON_PATHS[type],
  }]),
) as Record<C4ElementType, VisualToken>

const FALLBACK_TOKEN: VisualToken = {
  label: 'Concept',
  plural: 'Concepts',
  color: '#64748b',
  fg: '#fff',
  iconPath: TYPE_ICON_PATHS.group,
}

/** The groups the Hub lists its concern packs by, in their order. */
export const HUB_GROUPS: readonly string[] = CONCERN_GROUPS.map((g) => g.id)

/** Where a concept is listed: a concern pack's group, else its category. */
export const hubGroupOf = (c: { category: string; concern?: { group?: string } }): string => c.concern?.group ?? c.category

const GROUP_COLORS: Record<string, string> = {
  security: '#b91c1c', api: '#1d4ed8', architecture: '#0f766e', coding: '#4d7c0f',
  sdlc: '#6d28d9', technology: '#475569', compliance: '#0e7490', operability: '#047857',
}

const GROUP_THEME: Record<string, VisualToken> = Object.fromEntries(CONCERN_GROUPS.map((g) => [g.id, {
  label: g.label, plural: g.label, color: GROUP_COLORS[g.id], fg: '#fff', iconPath: TYPE_ICON_PATHS.adr,
}]))

/** The look of a concern group or of a category. */
export function categoryTheme(category: string): VisualToken {
  return GROUP_THEME[category] ?? CATEGORY_THEME[category as HubCategory] ?? FALLBACK_TOKEN
}

export function nodeTypeTheme(type: string): VisualToken {
  return NODE_TYPE_THEME[type as C4ElementType] ?? { ...FALLBACK_TOKEN, label: type, plural: type }
}
