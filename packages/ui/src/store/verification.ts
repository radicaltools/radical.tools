// ─── What the check says about each element, for the properties card ─────────
//
// The host (Studio) puts here what `radical check` says about the open
// model: the evidence of the test results and measurements beside it, and
// the findings by the element they are about or name. The card's
// Verification section reads it in every perspective; empty, the section
// shows nothing.

import { create } from 'zustand'
import type { CheckFinding, EvidenceEntry } from '@radical/common/check'

export interface CardVerification {
  /** By element id (CheckResult.evidence.nodes); null without results. */
  evidence: Record<string, EvidenceEntry> | null
  /** By element id: the findings about it or naming it. */
  findings: Record<string, CheckFinding[]>
}

export const useCardVerification = create<CardVerification>()(() => ({ evidence: null, findings: {} }))

/** The findings of a check by each element they are about or name. */
export function findingsByElement(findings: CheckFinding[]): Record<string, CheckFinding[]> {
  const by: Record<string, CheckFinding[]> = {}
  for (const f of findings) {
    for (const id of new Set([f.nodeId, ...(f.relatedIds ?? [])])) {
      if (id) (by[id] ??= []).push(f)
    }
  }
  return by
}
