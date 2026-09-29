// ─── Wireframe generation hook ───────────────────────────────────────────────
//
// MockupWireframe offers "Generate wireframe" only when the app registers a
// generator. Studio registers its AI-backed one (ai/wireframeGenerator.ts);
// the read-only Hub viewer registers none.

import type { C4Node, C4Relation } from '@radical/common/c4'

export interface WireframeGenerator {
  /** Whether generation is currently possible (e.g. AI is configured). */
  enabled(): boolean
  generate(
    mockupId: string,
    nodes: Record<string, C4Node>,
    relations: Record<string, C4Relation>,
    signal: AbortSignal,
  ): Promise<{ svg: string; usage?: { inputTokens: number; outputTokens: number } }>
}

let generator: WireframeGenerator | null = null

export function setWireframeGenerator(next: WireframeGenerator | null): void {
  generator = next
}

export function wireframeGenerator(): WireframeGenerator | null {
  return generator
}
