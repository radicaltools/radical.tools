// ─── Node sides ──────────────────────────────────────────────────────────────
//
// The side of a node an edge attaches to. The values match reactflow's
// `Position` enum ('top' | 'right' | 'bottom' | 'left') so the canvas can pass
// them straight through, while this package stays free of UI dependencies.

export const Position = {
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
  Left: 'left',
} as const

export type Position = (typeof Position)[keyof typeof Position]
