// ─── The verification path from the properties card ──────────────────────────
//
// The card in Designer and Viewer offers Path on a need, requirement,
// scenario, ADR or fitness function (useVerificationPath in @radical/ui).
// Studio shows it in the Inspector: the path is part of the Inspector's
// place (useInspectorNav.trace), so Back returns to the canvas. Like the
// Inspector's button, it waits for test results, measurements or a base
// beside the model.

import { useVerificationPath } from '@radical/ui/store/showInView'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useInspectorNav } from '../navigation'
import { useInspectorStore } from './inspector'
import { useBranchStore } from './branchChanges'

export const PATH_UNAVAILABLE = 'Verification path — no check report or measurements beside this model yet. Run radical check <model folder> --report <test reports>, or radical sense, to make one; Studio picks it up by itself.'

/** Opens the Inspector on `nodeId`'s verification path. */
export function openVerificationPath(nodeId: string): void {
  useInspectorNav.setState({ trace: nodeId })
  useDiagramStore.getState().setAppMode('inspector')
}

const availability = (): void => {
  const { results, measurements } = useInspectorStore.getState()
  const ready = results !== null || measurements !== null || useBranchStore.getState().base !== null
  const unavailable = ready ? null : PATH_UNAVAILABLE
  if (useVerificationPath.getState().unavailable !== unavailable || !useVerificationPath.getState().open) {
    useVerificationPath.setState({ open: openVerificationPath, unavailable })
  }
}

if (typeof window !== 'undefined') {
  availability()
  useInspectorStore.subscribe(availability)
  useBranchStore.subscribe(availability)
  // Leaving the Inspector leaves its path: its button opens it on its tabs
  // again, and Back returns to the path (the route keeps it).
  useDiagramStore.subscribe((s, p) => {
    if (p.appMode === 'inspector' && s.appMode !== 'inspector' && useInspectorNav.getState().trace) useInspectorNav.setState({ trace: null })
  })
}
