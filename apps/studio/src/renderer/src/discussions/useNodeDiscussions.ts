import { useEffect, useSyncExternalStore } from 'react'
import type { NodeDiscussionCounts } from '@radical/common/discussions'
import { discussionSession } from './session'

const EMPTY: NodeDiscussionCounts = Object.freeze({})
const noCounts = (): NodeDiscussionCounts => EMPTY
const noSubscription = (): (() => void) => () => {}

/** Discussion metadata remains outside the diagram store and its exports. */
export function useNodeDiscussions(documentId: string | undefined): NodeDiscussionCounts {
  const session = documentId ? discussionSession(documentId) : null
  useEffect(() => session?.watch(), [session])
  return useSyncExternalStore(session?.subscribe ?? noSubscription, session?.getNodeCounts ?? noCounts)
}
